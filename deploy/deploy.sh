#!/usr/bin/env bash
# Repeatable deploy: pull latest code, rebuild images, apply pending Prisma
# migrations, restart the stack. Run this ON the EC2 host from the repo root
# (or via `./deploy/deploy.sh`) for every deploy after the first.
#
# First-time setup is deploy/setup-ec2.sh then deploy/init-letsencrypt.sh —
# run those before this script the very first time.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Missing .env.production — copy .env.production.example and fill it in first." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "### Pulling latest code ..."
git pull --ff-only

echo "### Building images ..."
$COMPOSE build

# Runs as its own one-off container (not baked into the api entrypoint) so a
# failed migration blocks the deploy loudly instead of the api container
# crash-looping against a half-migrated schema.
echo "### Applying database migrations ..."
$COMPOSE run --rm api npx prisma migrate deploy

echo "### Starting/updating containers ..."
$COMPOSE up -d --remove-orphans

echo "### Pruning dangling images ..."
docker image prune -f

echo "### Status ..."
$COMPOSE ps

DOMAIN="$(grep -E '^DOMAIN=' .env.production | cut -d= -f2-)"
if [ -n "$DOMAIN" ]; then
  echo "### Health check ..."
  sleep 3
  curl -fsS "https://$DOMAIN/api/health" && echo || echo "Health check failed — check 'docker compose -f docker-compose.prod.yml logs api'"
fi
