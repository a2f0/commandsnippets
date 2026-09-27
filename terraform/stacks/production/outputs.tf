output "d1_database_id" {
  description = "D1 database ID (must match packages/backend-v2/wrangler.jsonc)."
  value       = module.environment.d1_database_id
}
