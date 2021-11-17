terraform {
  backend "s3" {}
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "backups" {
  bucket = "tearleads-backups"
  acl    = "private"
}
