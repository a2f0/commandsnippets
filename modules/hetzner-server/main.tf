resource "hcloud_firewall" "firewall" {
  name = "${var.environment}-web"

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }
}

resource "hcloud_server" "server" {
  name         = var.environment
  image        = "ubuntu-24.04"
  server_type  = "cax11"
  location     = "nbg1"
  ssh_keys     = [var.ssh_key_id]
  firewall_ids = [hcloud_firewall.firewall.id]

  user_data = <<-EOF
              #!/bin/bash
              echo ${var.hostname} > /etc/hostname
              hostname ${var.hostname}
              adduser --disabled-password --gecos "" ${var.deployment_user}
              echo "${var.deployment_user} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-terraform-init
              chmod 440 /etc/sudoers.d/91-terraform-init
              mkdir /home/${var.deployment_user}/.ssh
              chown ${var.deployment_user}:${var.deployment_user} /home/${var.deployment_user}/.ssh
              chmod 700 /home/${var.deployment_user}/.ssh
              touch /home/${var.deployment_user}/.ssh/authorized_keys
              chmod 400 /home/${var.deployment_user}/.ssh/authorized_keys
              chown ${var.deployment_user}:${var.deployment_user} /home/${var.deployment_user}/.ssh/authorized_keys
              echo "${var.deployment_public_key}" > /home/${var.deployment_user}/.ssh/authorized_keys

              rm -rf /etc/sudoers.d/90-cloud-init-users
              EOF
}

resource "cloudflare_record" "host" {
  zone_id = var.cloudflare_zone_id
  name    = "${var.hostname}.tearleads.com"
  content = hcloud_server.server.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = false
}

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_subdomain
  content = hcloud_server.server.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = true
}

resource "null_resource" "capture_ssh_host_keys" {
  depends_on = [hcloud_server.server, cloudflare_record.host]

  triggers = {
    server_id = hcloud_server.server.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Wait for SSH to become available (retry up to 30 times with 10 second delay)
      for i in $(seq 1 30); do
        if ssh-keyscan -H ${hcloud_server.server.ipv4_address} > ./ssh_host_keys.txt 2>/dev/null && [ -s ./ssh_host_keys.txt ]; then
          echo "SSH host keys captured successfully"
          break
        fi
        echo "Waiting for SSH to become available... (attempt $i/30)"
        sleep 10
      done

      # Check if we got the keys
      if [ ! -s ./ssh_host_keys.txt ]; then
        echo "Failed to capture SSH host keys after 30 attempts"
        exit 1
      fi

      # Enable strict error handling for remaining commands
      set -e

      # Use GitHub CLI to set the secret directly with proper base64 encoding
      gh secret set ${var.github_secret_prefix}_KNOWN_HOSTS_BASE64 -R "${var.github_owner}/${var.github_repository}" --body "$(cat ./ssh_host_keys.txt | base64)"

      gh secret set DEPLOY_${var.github_secret_prefix}_FQDN -R "${var.github_owner}/${var.github_repository}" --body "${hcloud_server.server.ipv4_address}"

      # Update local ~/.ssh/known_hosts
      # Remove any existing entries for this hostname
      ssh-keygen -R ${var.hostname}.tearleads.com 2>/dev/null || true
      # Add the new host keys (unhashed version for local use)
      ssh-keyscan ${var.hostname}.tearleads.com >> ~/.ssh/known_hosts 2>/dev/null
      echo "Updated local ~/.ssh/known_hosts with new host keys for ${var.hostname}.tearleads.com"

      # Clean up
      rm -f ./ssh_host_keys.txt
    EOT
  }
}
