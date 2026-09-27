# Staging. Its hostnames (api-staging, app-staging, website-staging: one level
# below the apex, which the zone's Universal SSL covers) are custom domains in
# each package's wrangler.jsonc.

locals {
  account_id = "0be508e6c4caa573595c5f94e11900e4"
}

module "environment" {
  source = "../../modules/environment"

  account_id       = local.account_id
  d1_database_name = "commandsnippets-staging"
}

# Created with wrangler before this stack existed; its ID is in
# packages/backend-v2/wrangler.jsonc.
import {
  to = module.environment.cloudflare_d1_database.this
  id = "${local.account_id}/fa0a2b48-82ac-42c8-af40-00e3d834d0ac"
}
