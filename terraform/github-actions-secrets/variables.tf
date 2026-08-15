variable "github_owner" {
  description = "Owner of the target GitHub repository."
  type        = string
  default     = "a2f0"
}

variable "github_repository" {
  description = "Target GitHub repository name."
  type        = string
  default     = "commandsnippets"
}

variable "github_public_key_id" {
  description = "ID of the GitHub public key used to seal the secret values."
  type        = string
}

variable "encrypted_secrets" {
  description = "GitHub-sealed ciphertext keyed by Actions secret name."
  type        = map(string)
}
