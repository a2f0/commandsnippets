terraform {
  backend "s3" {}
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "backups" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_acl" "backups_acl" {
  bucket = aws_s3_bucket.backups.id
  acl    = "private"
}

resource "aws_s3_bucket_public_access_block" "public_access_block" {
  bucket              = aws_s3_bucket.backups.id
  block_public_acls   = true
  block_public_policy = true
}
