provider "aws" {
  access_key = ""
  secret_key = ""
  region     = "us-east-1"
}

provider "github" {
  owner = "a2f0"
  token = var.github_token
}

terraform {
  backend "s3" {}
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

// Pull images. For web frontends.
data "aws_iam_policy_document" "pull" {

  //* required.
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = [
      "*",
    ]
  }

  // Download images from ECR
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

// Write access to images. For CI/CD.
data "aws_iam_policy_document" "push" {

  //* required.
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = [
      "*",
    ]
  }

  // Download and Upload Images to ECR
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:GetRepositoryPolicy",
      "ecr:DescribeRepositories",
      "ecr:ListImages",
      "ecr:DescribeImages",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage"
    ]
    resources = [
      aws_ecr_repository.main.arn,
    ]
  }
}

resource "aws_ecr_repository" "main" {
  name = var.registry_name
}

resource "aws_iam_role_policy" "web_frontend" {
  name   = "tf-tearleads-web-frontend-role-policy"
  role   = aws_iam_role.web_frontend.id
  policy = data.aws_iam_policy_document.pull.json
}

resource "aws_iam_role" "web_frontend" {
  name               = "tf-tearleads-web-iam-role"
  assume_role_policy = data.aws_iam_policy_document.instance-assume-role-policy.json
}

// To pass to an EC2 instance
resource "aws_iam_instance_profile" "web_frontend" {
  name = "tf-tearleads-iam-instance-profile"
  role = aws_iam_role.web_frontend.name
}

resource "aws_iam_user" "ci_cd" {
  name = "tf-tearleads-ci-cd"
}

resource "aws_iam_user_policy" "ci_cd" {
  name   = "tf-teadleads-ci-cd-user-policy"
  user   = aws_iam_user.ci_cd.name
  policy = data.aws_iam_policy_document.push.json
}

resource "aws_iam_access_key" "ci_cd" {
  user = aws_iam_user.ci_cd.name
}

resource "github_actions_secret" "ci_cd_access_key" {
  repository  = var.github_repository
  secret_name = "AWS_ACCESS_KEY_ID"
  value       = aws_iam_access_key.ci_cd.id
}

resource "github_actions_secret" "ci_cd_secret_access_key" {
  repository  = var.github_repository
  secret_name = "AWS_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.ci_cd.secret
}

// IAM user for external hosts (Hetzner) to pull from ECR
resource "aws_iam_user" "ecr_pull" {
  name = "tf-tearleads-ecr-pull"
}

resource "aws_iam_user_policy" "ecr_pull" {
  name   = "tf-tearleads-ecr-pull-user-policy"
  user   = aws_iam_user.ecr_pull.name
  policy = data.aws_iam_policy_document.pull.json
}

resource "aws_iam_access_key" "ecr_pull" {
  user = aws_iam_user.ecr_pull.name
}
