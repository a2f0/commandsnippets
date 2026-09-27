output "d1_database_id" {
  description = "D1 database ID, for backend-v2's wrangler.jsonc."
  value       = cloudflare_d1_database.this.id
}
