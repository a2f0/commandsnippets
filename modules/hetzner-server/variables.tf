variable "environment" {
  type = string
}

variable "hostname" {
  type = string
}

variable "deployment_user" {
  type = string
}

variable "deployment_public_key" {
  type = string
}

variable "ssh_key_id" {
  type        = string
  description = "ID of the SSH key in Hetzner"
}

variable "api_subdomain" {
  type        = string
  description = "Subdomain for the API record (e.g., 'api' or 'staging-api')"
}

variable "api_proxied" {
  type        = bool
  description = "Whether Cloudflare proxies the API DNS record"
  default     = true
}

variable "github_secret_prefix" {
  type        = string
  description = "Prefix for GitHub secrets (e.g., 'PRODUCTION' or 'STAGING')"
}

variable "github_owner" {
  type = string
}

variable "github_repository" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}
