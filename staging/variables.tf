variable "hostname" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "environment" {
  type = string
}

variable "remote_state_bucket" {
  type = string
}

variable "staging_api" {
  type = string
}

variable "staging_web" {
  type = string
}

variable "deployment_user" {
  type = string
}

variable "deployment_public_key" {
  type = string
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

variable "github_token" {
  type = string
}
