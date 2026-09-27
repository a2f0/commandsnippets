output "caa_issuers" {
  description = "Certificate authorities the zone's CAA records allow."
  value       = module.zone.caa_issuers
}
