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

data "hcloud_image" "ubuntu" {
  name              = "ubuntu-24.04"
  with_architecture = "x86"
}

resource "hcloud_server" "server" {
  name         = var.environment
  image        = data.hcloud_image.ubuntu.id
  server_type  = "cx23"
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

resource "cloudflare_dns_record" "host" {
  zone_id = var.cloudflare_zone_id
  name    = "${var.hostname}.commandsnippets.com"
  content = hcloud_server.server.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_subdomain
  content = hcloud_server.server.ipv4_address
  type    = "A"
  ttl     = 1
  proxied = var.api_proxied
}
