provider "github" {
  owner = var.github_owner
}

resource "github_actions_secret" "managed" {
  for_each = var.encrypted_secrets

  repository      = var.github_repository
  secret_name     = each.key
  key_id          = var.github_public_key_id
  value_encrypted = each.value

  lifecycle {
    prevent_destroy = true
  }
}
