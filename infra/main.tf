terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_security_group" "celsus" {
  name        = "celsus-sg"
  description = "Security group for Celsus stack"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "celsus" {
  name = "celsus-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.celsus.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}

resource "aws_s3_bucket" "celsus" {
  bucket_prefix = "celsus-"
  force_destroy = true
}

resource "aws_iam_role_policy" "s3" {
  name = "celsus-s3-access"
  role = aws_iam_role.celsus.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ]
      Resource = [
        aws_s3_bucket.celsus.arn,
        "${aws_s3_bucket.celsus.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "celsus" {
  name = "celsus-ec2-profile"
  role = aws_iam_role.celsus.name
}

resource "aws_instance" "celsus" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t4g.micro"
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.celsus.id]
  iam_instance_profile   = aws_iam_instance_profile.celsus.name
  subnet_id              = data.aws_subnets.default.ids[0]

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # System update
    apt-get update && apt-get upgrade -y

    # Docker
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu

    # Swap (2GB)
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Utilities
    apt-get install -y git jq
  EOF

  tags = {
    Name = "celsus"
  }
}

resource "aws_eip" "celsus" {
  instance = aws_instance.celsus.id
  domain   = "vpc"
}
