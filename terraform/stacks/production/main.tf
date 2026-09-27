# Production. Its hostnames (api, app and the apex website) are custom domains
# in each package's wrangler.jsonc, added at cutover after the data import so
# the live domains never serve an empty database.

locals {
  account_id = "0be508e6c4caa573595c5f94e11900e4"
}

module "environment" {
  source = "../../modules/environment"

  account_id       = local.account_id
  d1_database_name = "commandsnippets-production"
}

# Created with wrangler before this stack existed; its ID is in
# packages/backend-v2/wrangler.jsonc.
import {
  to = module.environment.cloudflare_d1_database.this
  id = "${local.account_id}/12e98511-6a2c-4d78-9bed-42990cc76072"
}
