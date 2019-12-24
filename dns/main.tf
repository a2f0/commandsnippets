terraform {
  backend "s3" {
  }
}

provider "aws" {
  access_key = ""
  secret_key = ""
  region     = "us-east-1"
  version    = "~> 2.0"
}

data "aws_route53_zone" "tearleads-zone" {
  name         = "tearleads.com."
  private_zone = false
}

resource "aws_route53_record" "tearleads-beta" {
  name    = "tearleads.com"
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  type    = "TXT"
  ttl     = "30"
  records = ["google-site-verification=-U0LmlFws7EMjM8T1_HE3JFm1yrPFBscL-MT2n7y9RY"]
}
