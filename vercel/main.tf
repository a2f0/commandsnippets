provider "vercel" {
  token = var.vercel_token
}

resource "vercel_project" "tearleads" {
  name         = "tearleads"
  output_directory = "build"
  git_repository {
    type = "github"
    repo = "${var.github_owner}/${var.github_repository}"
  }
  domain   {
    name           = var.domain
  }
}

resource "vercel_domain" "tearleads" {
  name = var.domain
}
