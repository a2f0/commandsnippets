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

// Do not delete this, Google periodically checks for it.
resource "aws_route53_record" "tearleads-google-domain-verification" {
  name    = "tearleads.com"
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  type    = "TXT"
  ttl     = "30"
  records = ["google-site-verification=-U0LmlFws7EMjM8T1_HE3JFm1yrPFBscL-MT2n7y9RY"]
}

resource "aws_route53_record" "tearleads-mx" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "tearleads.com"
  type    = "MX"
  ttl     = "600"
  records = [ "1 ASPMX.L.GOOGLE.COM",
              "5 ALT1.ASPMX.L.GOOGLE.COM.",
              "5 ALT2.ASPMX.L.GOOGLE.COM.",
              "10 ASPMX2.GOOGLEMAIL.COM.",
              "10 ASPMX3.GOOGLEMAIL.COM." ]       
}

resource "aws_route53_record" "tearleads-github" {
  zone_id = data.aws_route53_zone.tearleads-zone.zone_id
  name    = "tearleads.com"
  type    = "A"
  ttl     = "30"
  records = [ "185.199.108.153",
              "185.199.109.153",
              "185.199.110.153",
              "185.199.111.153"
            ]
}