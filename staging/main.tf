terraform {
  backend "s3" {}
}

// For pulling in the IAM profile
data "terraform_remote_state" "container-registry" {
  backend = "s3"
  config = {
    bucket = var.remote_state_bucket
    key    = "container-registry/terraform.tfstate"
    region = "us-east-1"
  }
}

data "cloudflare_zones" "zone" {
  filter {
    name = "tearleads.com"
  }
}

provider "aws" {
  access_key = ""
  secret_key = ""
  region     = "us-east-1"
}
provider "cloudflare" {
  email   = var.cloudflare_email
  api_key = var.cloudflare_api_key
}

resource "aws_vpc" "vpc" {
  cidr_block       = var.vpc_cidr
  instance_tenancy = "default"
  tags = {
    Name = "vpc-${var.environment}"
  }
}

resource "aws_security_group" "security-group" {
  name        = "${var.environment}-web"
  description = "${var.environment}-web"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_subnet" "aws-subnet" {
  vpc_id                  = aws_vpc.vpc.id
  cidr_block              = var.vpc_cidr
  map_public_ip_on_launch = "true"
  availability_zone       = "us-east-1a"
  tags = {
    Name = "main-subnet-${var.environment}"
  }
}

resource "aws_internet_gateway" "internet-gateway" {
  vpc_id = aws_vpc.vpc.id
}

resource "aws_default_route_table" "route-table" {
  default_route_table_id = aws_vpc.vpc.default_route_table_id
  route {
    gateway_id = aws_internet_gateway.internet-gateway.id
    cidr_block = "0.0.0.0/0"
  }
  tags = {
    Name = "default-table-${var.environment}"
  }
}

resource "aws_instance" "ec2" {
  ami                    = "ami-029f33a91738d30e9" # 24.04 LTS https://cloud-images.ubuntu.com/locator/ec2/
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.aws-subnet.id
  vpc_security_group_ids = [aws_security_group.security-group.id]
  key_name               = "dps-blackbox"
  iam_instance_profile   = data.terraform_remote_state.container-registry.outputs.iam-instance-profile
  tags = {
    Name = var.environment
  }
  root_block_device {
    volume_size = 10
  }
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
              deluser --remove-home ubuntu
              EOF
}



data "aws_route53_zone" "tearleads-zone" {
  name         = "tearleads.com."
  private_zone = false
}

resource "cloudflare_record" "host" {
  zone_id = data.cloudflare_zones.zone.zones[0]["id"]
  name    = "${var.hostname}.${data.aws_route53_zone.tearleads-zone.name}"
  content = aws_instance.ec2.public_ip
  type    = "A"
  ttl     = 1
  proxied = false
}

resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zones.zone.zones[0]["id"]
  name    = var.staging_api
  content = aws_instance.ec2.public_ip
  type    = "A"
  ttl     = 1
  proxied = true
}

resource "null_resource" "capture_ssh_host_keys" {
  depends_on = [aws_instance.ec2, cloudflare_record.host]

  # Add triggers to ensure this runs when the instance changes
  triggers = {
    instance_id = aws_instance.ec2.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Wait for SSH to become available (retry up to 30 times with 10 second delay)
      for i in $(seq 1 30); do
        if ssh-keyscan -H ${aws_instance.ec2.public_ip} > ./ssh_host_keys.txt 2>/dev/null && [ -s ./ssh_host_keys.txt ]; then
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
      gh secret set STAGING_KNOWN_HOSTS_BASE64 -R "${var.github_owner}/${var.github_repository}" --body "$(cat ./ssh_host_keys.txt | base64)"

      gh secret set DEPLOY_STAGING_FQDN -R "${var.github_owner}/${var.github_repository}" --body "${aws_instance.ec2.public_ip}"

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
