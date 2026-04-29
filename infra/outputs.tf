output "public_ip" {
  value = aws_eip.celsus.public_ip
}

output "instance_id" {
  value = aws_instance.celsus.id
}

output "s3_bucket" {
  value = aws_s3_bucket.celsus.id
}
