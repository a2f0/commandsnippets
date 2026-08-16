#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
terraform_dir="$(cd "$script_dir/.." && pwd)"
target_file="$script_dir/encrypted-secrets.auto.tfvars.json"
target_repository="a2f0/commandsnippets"

if [ -z "${AWS_PROFILE:-}" ]; then
  echo "AWS_PROFILE must name a profile with access to Terraform state." >&2
  exit 1
fi

for required_command in gh jq python3 sops ssh-keyscan terraform; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "$required_command is required" >&2
    exit 1
  fi
done

python_environment="$script_dir/.venv"
if [ ! -x "$python_environment/bin/python" ]; then
  python3 -m venv "$python_environment"
  "$python_environment/bin/pip" install \
    --requirement "$script_dir/requirements.txt"
fi

for source_stack in \
  container-registry \
  production \
  production-frontend \
  staging \
  staging-frontend; do
  if [ ! -d "$terraform_dir/$source_stack/.terraform" ]; then
    AWS_PROFILE="$AWS_PROFILE" \
      "$terraform_dir/$source_stack/init.sh" >/dev/null
  fi
done

public_key_response="$(
  gh api "repos/$target_repository/actions/secrets/public-key"
)"
github_public_key_id="$(jq -er '.key_id' <<<"$public_key_response")"
github_public_key="$(jq -er '.key' <<<"$public_key_response")"
encrypted_secrets='{}'
if [ -f "$target_file" ]; then
  previous_public_key_id="$(
    jq -er '.github_public_key_id' "$target_file"
  )"
  if [ "$previous_public_key_id" = "$github_public_key_id" ]; then
    encrypted_secrets="$(jq -c '.encrypted_secrets // {}' "$target_file")"
  fi
fi

terraform_output() {
  local stack=$1
  local output_name=$2
  AWS_PROFILE="$AWS_PROFILE" \
    terraform -chdir="$terraform_dir/$stack" output -json "$output_name" |
    jq -jer 'if type == "string" then . else tostring end'
}

emit_value() {
  printf '%s' "$1"
}

known_hosts_for_ip() {
  local server_ip=$1
  local known_hosts
  known_hosts="$(ssh-keyscan -H "$server_ip" 2>/dev/null)"
  if [ -z "$known_hosts" ]; then
    echo "No SSH host keys returned for $server_ip" >&2
    return 1
  fi
  printf '%s' "$known_hosts" | base64 | tr -d '\n'
}

add_secret() {
  local secret_name=$1
  shift

  local encrypted_value
  encrypted_value="$(
    "$@" |
      "$python_environment/bin/python" \
        "$script_dir/encryptSecret.py" "$github_public_key"
  )"

  encrypted_secrets="$(
    jq \
      --arg name "$secret_name" \
      --arg value "$encrypted_value" \
      '. + {($name): $value}' \
      <<<"$encrypted_secrets"
  )"
  echo "Encrypted $secret_name"
}

add_secret \
  AWS_ACCESS_KEY_ID \
  terraform_output container-registry ci-cd-access-key
add_secret \
  AWS_SECRET_ACCESS_KEY \
  terraform_output container-registry ci-cd-secret-access-key
add_secret \
  AWS_ACCESS_KEY_PRODUCTION \
  terraform_output production-frontend aws_access_key
add_secret \
  AWS_SECRET_ACCESS_KEY_PRODUCTION \
  terraform_output production-frontend aws_secret_access_key
add_secret \
  AWS_ACCESS_KEY_STAGING \
  terraform_output staging-frontend aws_access_key
add_secret \
  AWS_SECRET_ACCESS_KEY_STAGING \
  terraform_output staging-frontend aws_secret_access_key
add_secret \
  PRODUCTION_DOMAIN \
  terraform_output production-frontend domain
add_secret \
  STAGING_DOMAIN \
  terraform_output staging-frontend domain

production_ip="$(terraform_output production server_ipv4_address)"
production_user="$(terraform_output production deployment_user)"

add_secret DEPLOY_PRODUCTION_FQDN emit_value "$production_ip"
add_secret PRODUCTION_KNOWN_HOSTS_BASE64 known_hosts_for_ip "$production_ip"

if staging_ip="$(terraform_output staging server_ipv4_address 2>/dev/null)" &&
  staging_user="$(terraform_output staging deployment_user 2>/dev/null)"; then
  if [ "$production_user" != "$staging_user" ]; then
    echo "Production and staging deployment users differ" >&2
    exit 1
  fi
  add_secret DEPLOY_STAGING_FQDN emit_value "$staging_ip"
  add_secret STAGING_KNOWN_HOSTS_BASE64 known_hosts_for_ip "$staging_ip"
else
  for preserved_secret in \
    DEPLOY_STAGING_FQDN \
    STAGING_KNOWN_HOSTS_BASE64; do
    if ! jq -e \
      --arg name "$preserved_secret" \
      'has($name)' \
      <<<"$encrypted_secrets" >/dev/null; then
      echo "Cannot preserve missing $preserved_secret" >&2
      exit 1
    fi
  done
  echo "Staging outputs unavailable; preserved sealed staging host secrets"
fi

add_secret DEPLOY_USER emit_value "$production_user"
add_secret \
  SSH_KEY \
  sops decrypt \
  --input-type binary \
  --output-type binary \
  "$terraform_dir/ssh_keys/commandsnippets-github-actions.sops"

umask 077
temporary_file="$(mktemp "$script_dir/.encrypted-secrets.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

jq -n \
  --arg github_public_key_id "$github_public_key_id" \
  --argjson encrypted_secrets "$encrypted_secrets" \
  '{
    github_public_key_id: $github_public_key_id,
    encrypted_secrets: $encrypted_secrets
  }' >"$temporary_file"

mv "$temporary_file" "$target_file"
trap - EXIT
echo "Wrote GitHub-sealed values to $target_file"
