terraform {
  backend "s3" {}
}

//For pulling in the IAM profile
data "terraform_remote_state" "container-registry" {
  backend = "s3"
  config = {
    bucket = var.remote_state_bucket
    key = "container-registry/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  access_key = ""
  secret_key = ""
  region     = "us-east-1"
  version    = "~> 2.0"
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
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
  }
}

resource "aws_subnet" "aws-subnet" {
  vpc_id     = aws_vpc.vpc.id
  cidr_block = var.vpc_cidr
  map_public_ip_on_launch = "true"
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
    gateway_id  = aws_internet_gateway.internet-gateway.id
    cidr_block = "0.0.0.0/0"
  }
  tags = {
    Name = "default-table-${var.environment}"
  }
}

resource "aws_instance" "ec2" {
  #ami           = "ami-085925f297f89fce1" # bionic 18.04 LTS
  ami           = "ami-068663a3c619dd892" # focal 20.04 LTS
  instance_type = "t2.micro"
  subnet_id = aws_subnet.aws-subnet.id
  vpc_security_group_ids = [ aws_security_group.security-group.id ]
  key_name = "dps-blackbox"
  iam_instance_profile = data.terraform_remote_state.container-registry.outputs.iam-instance-profile
  tags = {
    Name = "${var.environment}"
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

resource "aws_route53_record" "route53-record" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "${var.hostname}.${data.aws_route53_zone.tearleads-zone.name}"
  type    = "A"
  ttl     = "30"
  records = [ aws_instance.ec2.public_ip ]
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "${var.production_api}.${data.aws_route53_zone.tearleads-zone.name}"
  type    = "A"
  ttl     = "30"
  records = [ aws_instance.ec2.public_ip ]
}

resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "${var.production_web}.${data.aws_route53_zone.tearleads-zone.name}"
  type    = "A"
  ttl     = "30"
  records = [ aws_instance.ec2.public_ip ]
}

resource "aws_route53_record" "tearleads" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "tearleads.com"
  type    = "A"
  ttl     = "30"
  records = [ aws_instance.ec2.public_ip ]
}
