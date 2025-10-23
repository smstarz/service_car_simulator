#!/usr/bin/env bash
# Ubuntu server bootstrap for Service Car Simulator
# Usage: sudo bash scripts/setup_ubuntu_server.sh

set -euo pipefail

echo "==> Updating apt and installing prerequisites"
apt-get update -y
apt-get install -y curl git build-essential

echo "==> Installing Node.js LTS (using NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs

echo "==> Installing nginx and certbot"
apt-get install -y nginx
apt-get install -y certbot python3-certbot-nginx || true

echo "==> Installing pm2 (global)"
npm install -g pm2

echo "==> Creating app directory: /var/www/service_car_simulator"
mkdir -p /var/www/service_car_simulator
chown -R $SUDO_USER:$SUDO_USER /var/www/service_car_simulator

echo "==> UFW: allow OpenSSH, HTTP, HTTPS"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 'Nginx Full' || true
fi

echo "==> Setup complete. Next: clone your repository into /var/www/service_car_simulator or run the deploy script."
