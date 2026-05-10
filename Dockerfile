# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

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
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app src ./src
COPY --chown=app:app package.json ./

USER app
EXPOSE 8080

# Use cluster mode by default to saturate CPU per container.
CMD ["node", "src/cluster.js"]
