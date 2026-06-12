# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
# No VITE_* build-time env vars needed — all API calls use relative paths
# so nginx handles routing at runtime via DATAHUB_FRONTEND_URL.
COPY . .
RUN npm run build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Install envsubst for runtime env var substitution
RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

# URL of DataHub frontend (Play Framework), which handles auth and proxies
# /api/* and /openapi/* to GMS. Matches VITE_PROXY_TARGET in dev.
ENV DATAHUB_FRONTEND_URL=http://datahub-frontend-react:9002

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '${DATAHUB_FRONTEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
