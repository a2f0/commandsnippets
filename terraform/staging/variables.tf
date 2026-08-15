variable "hostname" {
  type = string
}

variable "environment" {
  type = string
}

variable "api_subdomain" {
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

variable "github_owner" {
  type = string
}

variable "github_repository" {
  type = string
}
