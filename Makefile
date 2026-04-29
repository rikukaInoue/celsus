.PHONY: infra deploy destroy ssh

# Stand up AWS infrastructure (EC2, SG, EIP, S3, IAM)
infra:
	cd infra && terraform init && terraform apply

# Deploy app to EC2 (build + start containers)
deploy:
	./scripts/deploy.sh

# Tear down everything
destroy:
	cd infra && terraform destroy

# SSH into the instance
ssh:
	@cd infra && ssh -o StrictHostKeyChecking=no ubuntu@$$(terraform output -raw public_ip)
