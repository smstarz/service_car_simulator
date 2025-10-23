#!/usr/bin/env bash
# Simple deploy script for Ubuntu server
# Usage (on server):
#   cd /var/www/service_car_simulator
#   sudo bash scripts/deploy.sh

set -euo pipefail

APP_DIR="/var/www/service_car_simulator"
USER_NAME=${SUDO_USER:-$(whoami)}

echo "==> Entering app dir: $APP_DIR"
cd "$APP_DIR"

echo "==> Pulling latest from git"
if [ -d .git ]; then
  git pull --rebase
else
  echo "No .git found - ensure repo is cloned into $APP_DIR"
fi

echo "==> Installing npm dependencies"
npm ci --only=production || npm install --production

echo "==> Copy .env.example to .env if none exists"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example - update values as needed"
  fi
fi

echo "==> Starting application with pm2"
PM2_NAME="service-car-simulator"
pm2 start server.js --name "$PM2_NAME" --update-env || pm2 restart "$PM2_NAME" || pm2 start server.js --name "$PM2_NAME" --update-env
pm2 save

echo "==> Done. Use 'pm2 status' to check process."
