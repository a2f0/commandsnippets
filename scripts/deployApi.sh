#!/bin/sh
set -eu

usage() {
  echo "Usage: $0 <staging|production> [all|image|remote]" >&2
  exit 2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is required but was not found in PATH" >&2
    exit 1
  fi
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
fi

environment=$1
phase=${2:-all}

case "$environment" in
  staging)
    deploy_branch=staging
    latest_image_tag=backend-staging-latest
    deploy_fqdn=${DEPLOY_FQDN:-${DEPLOY_STAGING_FQDN:-}}
    known_hosts_base64=${DEPLOY_KNOWN_HOSTS_BASE64:-${STAGING_KNOWN_HOSTS_BASE64:-}}
    ;;
  production)
    deploy_branch=main
    latest_image_tag=backend-production-latest
    deploy_fqdn=${DEPLOY_FQDN:-${DEPLOY_PRODUCTION_FQDN:-}}
    known_hosts_base64=${DEPLOY_KNOWN_HOSTS_BASE64:-${PRODUCTION_KNOWN_HOSTS_BASE64:-}}
    ;;
  *)
    usage
    ;;
esac

case "$phase" in
  all | image | remote) ;;
  *) usage ;;
esac

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repository_directory=$(dirname "$script_directory")
aws_region=${AWS_REGION:-us-east-1}
ecr_repository=${ECR_REPOSITORY:-tftearleads}

build_and_push_image() {
  require_command aws
  require_command docker

  ecr_registry=${ECR_REGISTRY:-}
  if [ -z "$ecr_registry" ]; then
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    ecr_registry="$aws_account_id.dkr.ecr.$aws_region.amazonaws.com"

    aws ecr get-login-password --region "$aws_region" |
      docker login --username AWS --password-stdin "$ecr_registry"
  fi

  image_tag=${IMAGE_TAG:-${GITHUB_SHA:-}}
  if [ -z "$image_tag" ]; then
    image_tag=$(git -C "$repository_directory" rev-parse HEAD)
  fi

  docker buildx build \
    --platform linux/amd64 \
    -f "$repository_directory/backend/compose/django/Dockerfile.prod" \
    -t "$ecr_registry/$ecr_repository:$image_tag" \
    -t "$ecr_registry/$ecr_repository:$latest_image_tag" \
    --push \
    "$repository_directory/backend"
}

deploy_remote() {
  require_command ssh

  deploy_user=${DEPLOY_USER:-}
  if [ -z "$deploy_user" ] || [ -z "$deploy_fqdn" ]; then
    echo "ERROR: DEPLOY_USER and the environment's DEPLOY_*_FQDN are required" >&2
    exit 1
  fi

  temporary_ssh_directory=""
  identity_file=""
  known_hosts_file=""

  if [ -n "${SSH_KEY:-}" ] || [ -n "$known_hosts_base64" ]; then
    temporary_ssh_directory=$(mktemp -d)
  fi

  cleanup_ssh_files() {
    if [ -n "$temporary_ssh_directory" ]; then
      rm -rf -- "$temporary_ssh_directory"
    fi
  }
  trap cleanup_ssh_files EXIT HUP INT TERM

  if [ -n "${SSH_KEY:-}" ]; then
    identity_file="$temporary_ssh_directory/id_rsa"
    printf '%s\n' "$SSH_KEY" >"$identity_file"
    chmod 600 "$identity_file"
  fi

  if [ -n "$known_hosts_base64" ]; then
    require_command base64
    known_hosts_file="$temporary_ssh_directory/known_hosts"
    printf '%s\n' "$known_hosts_base64" | base64 -d >"$known_hosts_file"
    chmod 600 "$known_hosts_file"
  fi

  run_ssh() {
    if [ -n "$identity_file" ] && [ -n "$known_hosts_file" ]; then
      ssh -i "$identity_file" \
        -o UserKnownHostsFile="$known_hosts_file" \
        "$@"
    elif [ -n "$identity_file" ]; then
      ssh -i "$identity_file" "$@"
    elif [ -n "$known_hosts_file" ]; then
      ssh -o UserKnownHostsFile="$known_hosts_file" "$@"
    else
      ssh "$@"
    fi
  }

  deploy_target="$deploy_user@$deploy_fqdn"
  run_ssh "$deploy_target" \
    "cd \"\$HOME/commandsnippets\" && git pull --ff-only origin $deploy_branch"
  run_ssh "$deploy_target" \
    "exec \"\$HOME/commandsnippets/backend/deploy-containers.sh\""
}

case "$phase" in
  all)
    build_and_push_image
    deploy_remote
    ;;
  image)
    build_and_push_image
    ;;
  remote)
    deploy_remote
    ;;
esac
