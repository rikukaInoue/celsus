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

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "auth_google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "auth_google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
  default     = ""
}
