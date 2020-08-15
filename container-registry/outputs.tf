output "aws-region" {
  value = "${data.aws_region.current.name}"
}

output "repository-fqdn" {
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

output "iam-instance-profile" {
  value = "${aws_iam_instance_profile.web_frontend.id}"
}

output "ci-cd-access-key" {
  value = "${aws_iam_access_key.ci_cd.id}"
}

output "ci-cd-secret-access-key" {
  value = "${aws_iam_access_key.ci_cd.secret}"
}
