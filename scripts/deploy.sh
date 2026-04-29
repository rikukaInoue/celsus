#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"

cd "$INFRA_DIR"
IP=$(terraform output -raw public_ip)

echo "==> Deploying to $IP"

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
SSH_CMD="ssh $SSH_OPTS ubuntu@$IP"

echo "==> Waiting for SSH..."
until $SSH_CMD "echo ok" 2>/dev/null; do
  sleep 5
done

echo "==> Syncing files..."
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.yarn/cache' \
  --exclude='infra/.terraform' --exclude='infra/*.tfstate*' \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/" "ubuntu@$IP:/home/ubuntu/celsus/"

echo "==> Loading secrets from SSM Parameter Store..."
$SSH_CMD 'bash -s' << 'REMOTE_SCRIPT'
set -euo pipefail
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

get_param() {
  aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption --query 'Parameter.Value' --output text
}

DOMAIN=$(get_param /celsus/domain)

cat > /home/ubuntu/celsus/.env << ENVEOF
DOMAIN=${DOMAIN}
POSTGRES_PASSWORD=$(get_param /celsus/postgres-password)
AUTH_GOOGLE_CLIENT_ID=$(get_param /celsus/auth-google-client-id)
AUTH_GOOGLE_CLIENT_SECRET=$(get_param /celsus/auth-google-client-secret)
GITHUB_TOKEN=$(get_param /celsus/github-token)
BASE_URL=https://${DOMAIN}
ENVEOF

echo "==> .env created from SSM"
REMOTE_SCRIPT

echo "==> Building and starting containers..."
$SSH_CMD "cd /home/ubuntu/celsus && docker compose up -d --build"

echo "==> Deploy complete!"
