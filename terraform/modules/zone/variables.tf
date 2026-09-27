variable "zone_id" {
  description = "Cloudflare zone ID."
  type        = string
}

variable "zone_name" {
  description = "The zone's apex domain, e.g. commandsnippets.com."
  type        = string
}

variable "settings" {
  description = "Zone settings to enforce, by setting ID (see the Cloudflare zone settings API)."
  type        = map(string)
  default = {
    ssl              = "strict"
    always_use_https = "on"
    min_tls_version  = "1.2"
  }
}

variable "txt_records" {
  description = "TXT records at the apex, by name (e.g. domain verifications)."
  type        = map(string)
  default     = {}
}

variable "caa_issuers" {
  description = "Certificate authorities allowed to issue for the zone (CAA issue and issuewild)."
  type        = list(string)
  # The CAs Cloudflare uses for Universal SSL and Workers custom domains.
  default = ["letsencrypt.org", "pki.goog", "ssl.com"]
}

variable "redirect_www" {
  description = "Whether www.<zone_name> permanently redirects to the apex."
  type        = bool
  default     = true
}
