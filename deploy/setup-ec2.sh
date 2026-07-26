#!/usr/bin/env bash
# One-time bootstrap for a fresh EC2 instance. Written for Amazon Linux 2023
# (dnf-based) — the default user is ec2-user and there's no ufw package, so
# this differs from a Debian/Ubuntu bootstrap in a few places noted below.
#
# Run this ON the EC2 instance itself (e.g. over SSH), not from your laptop.
# It only installs software — it does not touch AWS resources, so there's
# nothing here that needs an AWS account/CLI.
#
# Usage: ./deploy/setup-ec2.sh <git-repo-url>

set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="$HOME/north-a-collaborative-travel-planner"

if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <git-repo-url>" >&2
  exit 1
fi

echo "### Updating base packages ..."
sudo dnf update -y

echo "### Installing Docker Engine (Amazon Linux 2023's own dnf package) + git ..."
sudo dnf install -y docker git

echo "### Installing the Docker Compose v2 CLI plugin ..."
# AL2023's dnf repos don't carry docker-compose-plugin the way Debian/Ubuntu's
# docker repo does, so this installs the official static binary as a CLI
# plugin instead — the documented method for distros without a packaged
# build. Installed system-wide (not per-user) so it works for any login user.
COMPOSE_VERSION="$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | grep -m1 '"tag_name"' | cut -d '"' -f4)"
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "### Enabling and starting Docker ..."
sudo systemctl enable --now docker

echo "### Adding $(whoami) to the docker group (takes effect on next login) ..."
sudo usermod -aG docker "$(whoami)"

# No host firewall step here (no ufw on Amazon Linux, and adding firewalld
# would be redundant with — and risk conflicting with — the EC2 Security
# Group, which already restricts inbound traffic to 22/80/443 at the AWS
# network layer, ahead of anything the instance itself could enforce).

# A small instance (t3.micro) can run out of RAM during `tsc`/`vite build`
# inside the image builds — a swapfile is cheap insurance against the build
# getting OOM-killed. No-ops if one already exists.
if [ ! -f /swapfile ]; then
  echo "### Adding a 2G swapfile ..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

if [ ! -d "$APP_DIR" ]; then
  echo "### Cloning $REPO_URL ..."
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "### $APP_DIR already exists, skipping clone."
fi

cat <<EOF

### Done.

Next steps:
  1. Log out and back in (or run 'newgrp docker') so your shell picks up
     docker group membership.
  2. cd $APP_DIR
  3. cp .env.production.example .env.production   # then fill in real values
  4. Point DOMAIN's DNS A record at this instance's public IP.
  5. ./deploy/init-letsencrypt.sh                  # one-time cert issuance
  6. ./deploy/deploy.sh                            # build, migrate, start
EOF
