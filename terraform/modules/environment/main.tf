# One deployment (staging or production): its D1 database. Worker code,
# secrets and hostnames (custom domains, in each package's wrangler.jsonc) are
# deployed with wrangler; see the packages' READMEs.

resource "cloudflare_d1_database" "this" {
  account_id = var.account_id
  name       = var.d1_database_name
  # No read replicas: backend-v2 reads its own writes (revisions, reorders).
  read_replication = {
    mode = "disabled"
  }

  # A database holds user data: never replace it from a plan.
  lifecycle {
    prevent_destroy = true
  }
}
