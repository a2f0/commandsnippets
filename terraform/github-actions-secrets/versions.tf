terraform {
  backend "s3" {}

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  required_version = "~> 1.15.0"
}
