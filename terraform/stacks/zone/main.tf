# commandsnippets.com zone-wide configuration, shared by staging and
# production: security settings, verification and CAA records, and the
# www redirect. Per-environment hostnames live in the staging/production stacks.

locals {
  zone_id   = "d81bdb232842e5cbc1e45996087a5fe2"
  zone_name = "commandsnippets.com"
}

module "zone" {
  source = "../../modules/zone"

  zone_id   = local.zone_id
  zone_name = local.zone_name
  txt_records = {
    # Google periodically re-checks it; keep it.
    "Google site verification" = "google-site-verification=-U0LmlFws7EMjM8T1_HE3JFm1yrPFBscL-MT2n7y9RY"
  }
}
