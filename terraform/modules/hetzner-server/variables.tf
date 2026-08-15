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

variable "cloudflare_zone_id" {
  type = string
}
