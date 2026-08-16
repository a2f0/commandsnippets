# Application environments

The production and staging backend environment files are encrypted with SOPS
and decrypted into short-lived, mode-`0600` temporary files by
`../run-playbook.sh`. Ansible copies the selected file to
`~/commandsnippets/backend/.env` on the target host.

Edit an environment with:

```sh
sops edit --input-type binary --output-type binary production.env.sops
```
