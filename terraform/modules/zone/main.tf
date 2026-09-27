# Zone-wide configuration shared by every environment on the domain.

resource "cloudflare_zone_setting" "this" {
  for_each = var.settings

  zone_id    = var.zone_id
  setting_id = each.key
  value      = each.value
}

resource "cloudflare_dns_record" "txt" {
  for_each = var.txt_records

  zone_id = var.zone_id
  name    = var.zone_name
  type    = "TXT"
  content = "\"${each.value}\""
  ttl     = 1
  proxied = false
  comment = "${each.key} (Terraform)"
}

resource "cloudflare_dns_record" "caa" {
  for_each = {
    for pair in setproduct(var.caa_issuers, ["issue", "issuewild"]) :
    "${pair[1]}-${pair[0]}" => { issuer = pair[0], tag = pair[1] }
  }

  zone_id = var.zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  proxied = false
  data = {
    flags = 0
    tag   = each.value.tag
    value = each.value.issuer
  }
  comment = "Terraform"
}

# www has no origin of its own: a proxied placeholder address lets the
# redirect rule below answer for it.
resource "cloudflare_dns_record" "www" {
  count = var.redirect_www ? 1 : 0

  zone_id = var.zone_id
  name    = "www.${var.zone_name}"
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
  comment = "Redirected to the apex (Terraform)"
}

resource "cloudflare_ruleset" "redirects" {
  count = var.redirect_www ? 1 : 0

  zone_id     = var.zone_id
  name        = "Redirects"
  description = "Single redirects (Terraform)"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [{
    ref         = "www_to_apex"
    description = "www.${var.zone_name} to ${var.zone_name}"
    expression  = "(http.host eq \"www.${var.zone_name}\")"
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://${var.zone_name}\", http.request.uri.path)"
        }
      }
    }
  }]
}
