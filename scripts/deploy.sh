#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"

# Get outputs from Terraform
cd "$INFRA_DIR"
IP=$(terraform output -raw public_ip)
KEY_NAME=$(terraform output -raw 2>/dev/null | grep -q key_name && terraform output -raw key_name || echo "")

echo "==> Deploying to $IP"

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
SSH_CMD="ssh $SSH_OPTS ubuntu@$IP"
SCP_CMD="scp $SSH_OPTS"

# Wait for SSH to be ready
echo "==> Waiting for SSH..."
until $SSH_CMD "echo ok" 2>/dev/null; do
  sleep 5
done

# Sync project files
echo "==> Syncing files..."
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.yarn/cache' \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/" "ubuntu@$IP:/home/ubuntu/celsus/"

# Create .env file from local env vars
echo "==> Setting up environment..."
$SSH_CMD "cat > /home/ubuntu/celsus/.env << 'ENVEOF'
DOMAIN=${DOMAIN:-library.rikuka.dev}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
AUTH_GOOGLE_CLIENT_ID=${AUTH_GOOGLE_CLIENT_ID}
AUTH_GOOGLE_CLIENT_SECRET=${AUTH_GOOGLE_CLIENT_SECRET}
GITHUB_TOKEN=${GITHUB_TOKEN:-}
BASE_URL=https://${DOMAIN:-library.rikuka.dev}
ENVEOF"

# Build and start
echo "==> Building and starting containers..."
$SSH_CMD "cd /home/ubuntu/celsus && docker compose up -d --build"

echo "==> Deploy complete! https://${DOMAIN:-library.rikuka.dev}"
