variable "region" {
  default = "ap-northeast-1"
}

variable "domain" {
  description = "Domain for Backstage (e.g. library.rikuka.dev)"
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR block allowed for SSH access"
  type        = string
}

variable "key_name" {
  description = "Name of the EC2 key pair"
  type        = string
}
