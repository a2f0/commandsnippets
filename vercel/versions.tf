terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = ">= 2.0"
    }
    github = {
      source  = "integrations/github"
      version = ">= 6.5.0"
    }
  }
  required_version = ">= 1.0.10"
}
