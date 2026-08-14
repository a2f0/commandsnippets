terraform {
  backend "s3" {}
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

provider "cloudflare" {
  email   = var.cloudflare_email
  api_key = var.cloudflare_api_key
}

provider "github" {
  token = var.github_token
}

data "cloudflare_zones" "zone" {
  name = "commandsnippets.com"
}

resource "aws_s3_bucket" "main" {
  bucket = var.domain
  tags = {
    Name = var.domain
  }
}

resource "aws_s3_bucket" "www" {
  bucket = "www.${var.domain}"
  tags = {
    Name = "www.${var.domain}"
  }
}

resource "aws_s3_bucket_website_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_website_configuration" "www" {
  bucket = aws_s3_bucket.www.id
  redirect_all_requests_to {
    host_name = var.domain
    protocol  = "https"
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_ownership_controls" "main" {
  bucket = aws_s3_bucket.main.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_policy" "main" {
  bucket = aws_s3_bucket.main.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.main.arn}/*"
      }
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.main]
}

resource "aws_acm_certificate" "cert" {
  provider                  = aws.us_east_1
  domain_name               = var.domain
  subject_alternative_names = ["www.${var.domain}"]
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "caa_aws" {
  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = "@" # @ represents the apex/root domain
  type    = "CAA"
  data = {
    flags = 0
    tag   = "issue"
    value = "amazontrust.com"
  }
  ttl     = 3600
  proxied = false
}

resource "cloudflare_dns_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = each.value.name
  content = each.value.record
  type    = each.value.type
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "cert" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for record in aws_acm_certificate.cert.domain_validation_options : record.resource_record_name]

  depends_on = [cloudflare_dns_record.cert_validation]

  timeouts {
    create = "45m"
  }
}

# CloudFront distribution
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "url-rewrite-production"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrite URLs to serve root index.html for all paths"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Check if the request is for a file with an extension (has a dot and not ending with /)
      if (uri.includes('.') && !uri.endsWith('/')) {
        // If it's a file request, leave it as is
        return request;
      }

      // For all other requests (paths without extensions or ending with /), serve the root index.html
      request.uri = '/index.html';

      return request;
    }
  EOT
}

resource "aws_cloudfront_function" "no_cache_response" {
  name    = "no-cache-response-production"
  runtime = "cloudfront-js-1.0"
  comment = "Add no-cache headers to index.html responses"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var response = event.response;

      // Add no-cache headers to all HTML responses
      // Since our viewer-request rewrites all non-file paths to index.html,
      // we can check the content-type to determine if this is an HTML response
      var contentType = response.headers['content-type'] ? response.headers['content-type'].value : '';

      if (contentType.includes('text/html')) {
        response.headers['cache-control'] = {value: 'no-cache, no-store, must-revalidate'};
        response.headers['pragma'] = {value: 'no-cache'};
        response.headers['expires'] = {value: '0'};
      }

      return response;
    }
  EOT
}

resource "aws_cloudfront_distribution" "website" {
  # Add explicit dependency on certificate validation
  depends_on = [aws_acm_certificate_validation.cert]

  origin {
    domain_name = aws_s3_bucket_website_configuration.main.website_endpoint
    origin_id   = "S3-${var.domain}"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain, "www.${var.domain}"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.domain}"

    # Add the cache policy ID for CachingDisabled managed policy
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0

    # Add the function associations
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }

    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.no_cache_response.arn
    }
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "cloudflare_dns_record" "production" {
  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = var.domain
  content = aws_cloudfront_distribution.website.domain_name
  type    = "CNAME"
  ttl     = 1
}

resource "cloudflare_dns_record" "www" {
  zone_id = data.cloudflare_zones.zone.result[0].id
  name    = "www"
  content = aws_cloudfront_distribution.website.domain_name
  type    = "CNAME"
  ttl     = 1
}

resource "aws_iam_policy" "s3_sync_policy" {
  name        = "S3Sync${var.domain}"
  description = "Policy to allow syncing files to ${var.domain} S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ],
        Resource = [
          "arn:aws:s3:::${var.domain}",
          "arn:aws:s3:::${var.domain}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_user" "s3_sync_user" {
  name = "s3-sync-${var.domain}"
}

resource "aws_iam_user_policy_attachment" "s3_sync_attachment" {
  user       = aws_iam_user.s3_sync_user.name
  policy_arn = aws_iam_policy.s3_sync_policy.arn
}

resource "aws_iam_access_key" "s3_sync_key" {
  user = aws_iam_user.s3_sync_user.name
}

resource "github_actions_secret" "aws_access_key" {
  repository      = var.github_repository
  secret_name     = "AWS_ACCESS_KEY_PRODUCTION"
  plaintext_value = aws_iam_access_key.s3_sync_key.id
}

resource "github_actions_secret" "aws_secret_key" {
  repository      = var.github_repository
  secret_name     = "AWS_SECRET_ACCESS_KEY_PRODUCTION"
  plaintext_value = aws_iam_access_key.s3_sync_key.secret
}

resource "github_actions_secret" "production_domain" {
  repository      = var.github_repository
  secret_name     = "PRODUCTION_DOMAIN"
  plaintext_value = var.domain
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.website.id
  description = "CloudFront distribution ID for cache invalidation"
}
