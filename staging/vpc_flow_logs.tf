resource "aws_iam_role_policy" "vpc_flow" {
  name = "tf-tearleads-vpc-flow-role-policy"
  role = aws_iam_role.vpc_flow.id

  policy = <<EOF
{
"Version": "2012-10-17",
"Statement": [
    {
    "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
    ],
    "Effect": "Allow",
    "Resource": "*"
    }
]
}
EOF
}


resource "aws_iam_role" "vpc_flow" {
   name = "tf-tearleads-vpc-flow-role"

assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "vpc-flow-logs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

// CloudWatch

resource "aws_flow_log" "vpc_flow_cloudwatch" {
  iam_role_arn              = aws_iam_role.vpc_flow.arn
  log_destination           = aws_cloudwatch_log_group.vpc_flow.arn
  traffic_type              = "ALL"
  vpc_id                    = aws_vpc.vpc.id
  max_aggregation_interval  = 60
}

resource "aws_cloudwatch_log_group" "vpc_flow" {
  name = "tf-tearleads-vpc-flow"
}

// S3

# resource "aws_flow_log" "vpc_flow_s3" {
#   log_destination           = aws_s3_bucket.vpc_flow.arn
#   log_destination_type      = "s3"
#   traffic_type              = "ALL"
#   vpc_id                    = aws_vpc.vpc.id
#   max_aggregation_interval  = 60
# }

# resource "aws_s3_bucket" "vpc_flow" {
#   bucket = "tf-tearleads-vpc-flow"
#   force_destroy             = true
# }