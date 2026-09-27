mock_provider "cloudflare" {}

variables {
  zone_id   = "0123456789abcdef0123456789abcdef"
  zone_name = "example.com"
  txt_records = {
    verification = "google-site-verification=abc"
  }
}

run "www_redirects_to_the_apex_keeping_path_and_query" {
  command = plan

  assert {
    condition     = cloudflare_ruleset.redirects[0].phase == "http_request_dynamic_redirect"
    error_message = "The redirect must be a single (dynamic) redirect rule."
  }

  assert {
    condition     = cloudflare_ruleset.redirects[0].rules[0].expression == "(http.host eq \"www.example.com\")"
    error_message = "Only www should match."
  }

  assert {
    condition     = cloudflare_ruleset.redirects[0].rules[0].action_parameters.from_value.target_url.expression == "concat(\"https://example.com\", http.request.uri.path)"
    error_message = "The target must be the apex with the same path."
  }

  assert {
    condition     = cloudflare_ruleset.redirects[0].rules[0].action_parameters.from_value.status_code == 301
    error_message = "www must redirect permanently."
  }

  assert {
    condition     = cloudflare_ruleset.redirects[0].rules[0].action_parameters.from_value.preserve_query_string
    error_message = "The query string must survive the redirect."
  }

  assert {
    condition     = cloudflare_dns_record.www[0].name == "www.example.com" && cloudflare_dns_record.www[0].proxied
    error_message = "www needs a proxied record for the rule to answer."
  }
}

run "no_www_redirect_when_disabled" {
  command = plan

  variables {
    redirect_www = false
  }

  assert {
    condition     = length(cloudflare_ruleset.redirects) == 0 && length(cloudflare_dns_record.www) == 0
    error_message = "Disabling the redirect must drop the rule and the record."
  }
}

run "caa_allows_exactly_cloudflares_cas" {
  command = plan

  assert {
    condition     = length(cloudflare_dns_record.caa) == 6
    error_message = "Each of the three CAs needs an issue and an issuewild record."
  }

  assert {
    condition = toset([for r in cloudflare_dns_record.caa : "${r.data.tag} ${r.data.value}"]) == toset([
      "issue letsencrypt.org", "issuewild letsencrypt.org",
      "issue pki.goog", "issuewild pki.goog",
      "issue ssl.com", "issuewild ssl.com",
    ])
    error_message = "CAA must allow Let's Encrypt, Google Trust Services and SSL.com."
  }
}

run "txt_records_are_quoted_at_the_apex" {
  command = plan

  assert {
    condition     = cloudflare_dns_record.txt["verification"].content == "\"google-site-verification=abc\""
    error_message = "TXT content must be quoted."
  }

  assert {
    condition     = cloudflare_dns_record.txt["verification"].name == "example.com"
    error_message = "TXT records belong at the apex."
  }
}

run "enforces_strict_tls" {
  command = plan

  assert {
    condition     = cloudflare_zone_setting.this["ssl"].value == "strict" && cloudflare_zone_setting.this["always_use_https"].value == "on" && cloudflare_zone_setting.this["min_tls_version"].value == "1.2"
    error_message = "The zone must use strict SSL, always HTTPS and TLS 1.2+."
  }
}
