# Build context for this image is the repo root (see docker-compose.prod.yml)
# so it can reach both frontend/ and nginx/.

# ---- build the frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
# Vite inlines VITE_* vars at build time, not at container start — so the
# real API origin has to be known when this image is built, via --build-arg.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- serve the built static files + reverse-proxy the API/sockets ----
FROM nginx:1.27-alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/proxy_params.conf /etc/nginx/proxy_params.conf
# templates/*.template are rendered into conf.d/ via envsubst by the base
# image's own entrypoint every time the container starts (see the template
# file's header comment) — this is what lets ${DOMAIN} come from docker-
# compose's `environment:` instead of being baked in at build time.
COPY nginx/templates /etc/nginx/templates
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80 443
