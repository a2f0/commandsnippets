variable "hostname" {
  type = string
}

variable "environment" {
  type = string
}

variable "deployment_user" {
  type = string
}

variable "deployment_public_key" {
  type = string
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_email" {
  type = string
}

variable "cloudflare_api_key" {
  type = string
}

# tflint-ignore: terraform_unused_declarations
variable "github_owner" {
  description = "Legacy input retained for compatibility with encrypted tfvars."
  type        = string
}

# tflint-ignore: terraform_unused_declarations
variable "github_repository" {
  description = "Legacy input retained for compatibility with encrypted tfvars."
  type        = string
}
