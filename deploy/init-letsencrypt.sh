#!/usr/bin/env bash
# One-time Let's Encrypt cert issuance. Run once after setup-ec2.sh, after
# .env.production is filled in, and after DOMAIN's DNS A record points at
# this instance's public IP (Let's Encrypt has to reach this box over :80 to
# validate the ACME challenge — this will fail if DNS isn't live yet).
#
# nginx's TLS server block needs a cert file to exist just to start, but we
# can't get a real one until nginx (serving the ACME challenge) is running —
# so this issues a throwaway self-signed cert first, boots nginx with it,
# then swaps it for the real Let's Encrypt cert.
#
# Adapted from the well-known wmnnd/nginx-certbot recipe.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Missing .env.production — copy .env.production.example and fill it in first." >&2
  exit 1
fi

set -a
source .env.production
set +a

if [ -z "${DOMAIN:-}" ] || [ "$DOMAIN" = "your-domain.example.com" ]; then
  echo "Set a real DOMAIN in .env.production first." >&2
  exit 1
fi
if [ -z "${CERTBOT_EMAIL:-}" ] || [ "$CERTBOT_EMAIL" = "you@example.com" ]; then
  echo "Set a real CERTBOT_EMAIL in .env.production first." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "### Creating a dummy certificate for $DOMAIN so nginx can bind to :443 ..."
$COMPOSE run --rm --entrypoint "\
  mkdir -p /etc/letsencrypt/live/$DOMAIN && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'" certbot

echo "### Building and starting nginx (and its dependencies) ..."
$COMPOSE up -d --build nginx

echo "### Removing the dummy certificate ..."
$COMPOSE run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN \
         /etc/letsencrypt/archive/$DOMAIN \
         /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Requesting the real certificate from Let's Encrypt ..."
$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    -d $DOMAIN \
    --email $CERTBOT_EMAIL --agree-tos --no-eff-email" certbot

echo "### Reloading nginx with the real certificate ..."
$COMPOSE exec nginx nginx -s reload

echo "### Starting the certbot auto-renew loop ..."
$COMPOSE up -d certbot

echo
echo "Done. https://$DOMAIN should now serve a valid Let's Encrypt certificate."
