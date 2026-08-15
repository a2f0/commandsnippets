terraform {
  backend "s3" {}
}

provider "aws" {
  region = "us-east-1"
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  email   = var.cloudflare_email
  api_key = var.cloudflare_api_key
}

data "cloudflare_zones" "zone" {
  name = "commandsnippets.com"
}

data "hcloud_ssh_key" "deploy" {
  name = "dps-blackbox"
}

module "web" {
  source = "../modules/hetzner-server"

  environment           = var.environment
  hostname              = var.hostname
  deployment_user       = var.deployment_user
  deployment_public_key = var.deployment_public_key
  ssh_key_id            = data.hcloud_ssh_key.deploy.id
  api_subdomain         = "api"
  github_secret_prefix  = "PRODUCTION"
  github_owner          = var.github_owner
  github_repository     = var.github_repository
  cloudflare_zone_id    = data.cloudflare_zones.zone.result[0].id
}
