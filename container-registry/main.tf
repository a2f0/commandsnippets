provider "aws" {
  access_key = ""
  secret_key = ""
  region     = "us-east-1"
  version    = "~> 2.0" 
}

terraform {
  backend "s3" {}
}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "main" {
  name = var.registry_name
}

data "aws_iam_policy_document" "main" {

  //* required.
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = [
        "*",
    ]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
			"ecr:GetDownloadUrlForLayer",
			"ecr:GetRepositoryPolicy",
			"ecr:DescribeRepositories",
			"ecr:ListImages",
			"ecr:DescribeImages",
			"ecr:BatchGetImage"
    ]
    resources = [
        aws_ecr_repository.main.arn,
    ]
  }
}

resource "aws_iam_role_policy" "web_frontend" {
  name = "tf-tearleads-web-frontend-role-policy"
  role = aws_iam_role.web_frontend.id
  policy = data.aws_iam_policy_document.main.json
}

// Only allow EC2 instances to assume the role.
data "aws_iam_policy_document" "instance-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "web_frontend" {
  name = "tf-tearleads-web-iam-role"
  assume_role_policy = data.aws_iam_policy_document.instance-assume-role-policy.json
}

// To pass to an EC2 instance
resource "aws_iam_instance_profile" "web_frontend" {
  name = "tf-tearleads-iam-instance-profile"
  role = aws_iam_role.web_frontend.name
}
