terraform {
  backend "s3" {}
}

provider "vercel" {
  token = var.vercel_token
}

resource "vercel_project" "tearleads" {
  name             = "tearleads"
  output_directory = "build"
  git_repository {
    type = "github"
    repo = "${var.github_owner}/${var.github_repository}"
  }
  domain {
    name = var.domain
  }
}

resource "vercel_domain" "tearleads" {
  name = var.domain
}

provider "github" {
  token = var.github_token
  owner = var.github_owner
}

resource "github_actions_secret" "vercel_org_id" {
  repository      = var.github_repository
  secret_name     = "VERCEL_ORG_ID"
  plaintext_value = var.vercel_org_id
}

resource "github_actions_secret" "vercel_project_id" {
  repository      = var.github_repository
  secret_name     = "VERCEL_PROJECT_ID"
  plaintext_value = vercel_project.tearleads.id
}

resource "github_actions_secret" "vercel_token" {
  repository      = var.github_repository
  secret_name     = "VERCEL_TOKEN"
  plaintext_value = var.vercel_token
}
