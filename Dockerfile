FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=https://renvix.app
ARG NEXT_PUBLIC_AUTH_URL=https://accounts.renvix.app
ARG NEXT_PUBLIC_APP_URL=https://dash.renvix.app
ARG NEXT_PUBLIC_ADMIN_URL=https://wa-admin.renvix.app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
# Application code and static assets stay root-owned/read-only. Next.js only
# receives a dedicated writable cache directory at runtime.
RUN chmod -R a-w /app/public /app/.next/static /app/drizzle /app/scripts /app/src \
    && mkdir -p /app/.next/cache \
    && chown -R nextjs:nodejs /app/.next/cache
USER nextjs
EXPOSE 3000
# Database migrations run once in the dedicated release workflow before traffic
# is shifted. Keeping them out of web startup prevents replica races and restarts.
CMD ["node", "server.js"]
