# syntax=docker/dockerfile:1.7

# ---- build stage: compile TypeScript ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    LOG_DIR=/var/log/usi-payout \
    AUDIT_LOG_DIR=/var/log/usi-payout/audit

# Create unprivileged user and log dirs with restrictive permissions.
RUN addgroup -S app && adduser -S -G app app \
 && mkdir -p /var/log/usi-payout/audit \
 && chown -R app:app /var/log/usi-payout \
 && chmod -R 750 /var/log/usi-payout

WORKDIR /app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./

USER app
EXPOSE 8080

# Cluster mode saturates all CPU cores per container.
CMD ["node", "dist/cluster.js"]
