terraform {
  backend "s3" {}
}

provider "cloudflare" {
  email   = var.cloudflare_email
  api_key = var.cloudflare_api_key
}

data "cloudflare_zones" "zone" {
  name = "commandsnippets.com"
}

// Do not delete this, Google periodically checks for it.
resource "cloudflare_dns_record" "tearleads-google-domain-verification" {
  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = "@"
  type    = "TXT"
  content = "google-site-verification=-U0LmlFws7EMjM8T1_HE3JFm1yrPFBscL-MT2n7y9RY"
  ttl     = 60
  proxied = false
}

resource "cloudflare_dns_record" "tearleads-mx" {
  for_each = {
    aspmx  = { priority = 1, content = "ASPMX.L.GOOGLE.COM" }
    alt1   = { priority = 5, content = "ALT1.ASPMX.L.GOOGLE.COM" }
    alt2   = { priority = 5, content = "ALT2.ASPMX.L.GOOGLE.COM" }
    aspmx2 = { priority = 10, content = "ASPMX2.GOOGLEMAIL.COM" }
    aspmx3 = { priority = 10, content = "ASPMX3.GOOGLEMAIL.COM" }
  }

  zone_id  = data.cloudflare_zones.zone.result[0].id
  name     = "@"
  type     = "MX"
  content  = each.value.content
  priority = each.value.priority
  ttl      = 600
  proxied  = false
}

# resource "cloudflare_dns_record" "tearleads-github" {
#   for_each = toset([
#     "185.199.108.153",
#     "185.199.109.153",
#     "185.199.110.153",
#     "185.199.111.153",
#   ])
#
#   zone_id = data.cloudflare_zones.zone.result[0].id
#   name    = "@"
#   type    = "A"
#   content = each.value
#   ttl     = 60
#   proxied = false
# }

resource "cloudflare_dns_record" "tearleads-caa" {
  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = "@"
  type    = "CAA"
  content = "0 issue \"letsencrypt.org\""
  ttl     = 60
  proxied = false
}
