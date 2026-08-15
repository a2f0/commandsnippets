# GitHub Actions secrets

This stack manages repository-level Actions secrets for
`a2f0/commandsnippets`.

Secret plaintext is read from the existing Terraform states, live SSH host
keys, and the SOPS-encrypted monorepo deployment key. The refresh script seals
each value with the target repository's GitHub public key before writing
`encrypted-secrets.auto.tfvars.json`. Terraform configuration and state contain
only the sealed ciphertext. The S3 backend uses native state locking.

Run:

```sh
AWS_PROFILE=dansullivan ./init.sh
AWS_PROFILE=dansullivan ./refresh-secrets.sh
AWS_PROFILE=dansullivan ./apply.sh
```

Do not enable Terraform debug logging while refreshing or applying secrets.
Regenerate all ciphertext if GitHub rotates the repository public key.
