# State lives in Cloudflare R2 (S3-compatible). Credentials come from
# secrets.env.sops through scripts/tf (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY).
terraform {
  backend "s3" {
    bucket = "commandsnippets-terraform-state"
    key    = "zone/terraform.tfstate"
    region = "auto"
    endpoints = {
      s3 = "https://0be508e6c4caa573595c5f94e11900e4.r2.cloudflarestorage.com"
    }
    use_lockfile                = true
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
