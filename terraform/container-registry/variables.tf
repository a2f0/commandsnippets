variable "registry_name" {
  type = string
}

variable "github_repository" {
  type = string
}

variable "github_token" {
  type      = string
  sensitive = true
}
