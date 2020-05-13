output "aws-region" {
  value = "${data.aws_region.current.name}"
}
output "repository-fqdn" {
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}