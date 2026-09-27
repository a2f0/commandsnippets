# commandsnippets.com zone-wide configuration, shared by staging and
# production: security settings, verification and CAA records, and the
# www redirect. Per-environment hostnames are custom domains in each package's
# wrangler.jsonc.
#
# This stack created every record: the earlier dns stack was never applied (it
# had no state, and the zone had no records), so there was nothing to import.
# It had Google Workspace MX records; the domain has no mail, so they are gone.

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
