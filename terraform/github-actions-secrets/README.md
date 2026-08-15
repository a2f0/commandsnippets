# GitHub Actions secrets

This stack manages repository-level Actions secrets for
`a2f0/commandsnippets`.

Secret plaintext is read from the existing Terraform states, live SSH host
keys, and the SOPS-encrypted backend deployment key. The refresh script seals
each value with the target repository's GitHub public key before writing
`encrypted-secrets.auto.tfvars.json`. Terraform configuration and state contain
only the sealed ciphertext. The S3 backend uses native state locking.

Run:

```sh
AWS_PROFILE=dansullivan ./init.sh
AWS_PROFILE=dansullivan ./refresh-secrets.sh
AWS_PROFILE=dansullivan ./apply.sh
```

`SLACK_WEBHOOK_URL` is not recoverable from GitHub. To include it during a
refresh, read it without echoing it or placing it in shell history, then export
it for the refresh:

```sh
read -rs SLACK_WEBHOOK_URL
export SLACK_WEBHOOK_URL
AWS_PROFILE=dansullivan ./refresh-secrets.sh
unset SLACK_WEBHOOK_URL
```

Do not enable Terraform debug logging while refreshing or applying secrets.
Regenerate all ciphertext if GitHub rotates the repository public key.
