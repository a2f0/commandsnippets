output "deployment_user" {
  description = "User configured for application deployment over SSH."
  value       = var.deployment_user
}

output "server_ipv4_address" {
  description = "Public IPv4 address of the production server."
  value       = module.web.server_ipv4_address
}
