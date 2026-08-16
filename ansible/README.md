# Ansible

These playbooks configure the staging and production API hosts. Terraform
provides the ECR pull credentials and host inventory consumed by
`run-playbook.sh`.

## Setup

From the repository root:

```sh
brew install gnupg sops
python3 -m venv .venv
source .venv/bin/activate
pip install -r ansible/requirements.txt
ansible-galaxy collection install \
  -r ansible/requirements.yaml \
  -p .ansible/collections
```

Run or lint the playbooks with:

```sh
./ansible/staging.sh
./ansible/production.sh
./ansible/all.sh
ansible-lint ansible/playbook.yaml
```

Encrypted inventory and environment files use the GPG recipient configured in
the repository's `.sops.yaml`. The runner decrypts them into automatically
cleaned, mode-`0600` temporary files.

## Backend server checkout

Ansible uses a filtered sparse checkout of the monorepo on each API server.
The Git worktree at `~/commandsnippets` contains only `backend/`; repository
metadata remains at `~/commandsnippets/.git` so GitHub Actions can update the
configured `main` or `staging` branch before deploying.
