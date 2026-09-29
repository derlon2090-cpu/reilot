FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder
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
RUN npm run build:migration-runner

FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runner
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
COPY --from=builder /app/.next/migrate.bundle.cjs ./scripts/migrate.bundle.cjs
# Application code and static assets stay root-owned/read-only. Next.js only
# receives a dedicated writable cache directory at runtime.
RUN chmod -R a-w /app/public /app/.next/static /app/drizzle /app/scripts /app/src \
    && mkdir -p /app/.next/cache \
    && chown -R nextjs:nodejs /app/.next/cache
USER nextjs
EXPOSE 3000
# Apply every pending, checksummed migration under the PostgreSQL advisory
# lock before accepting traffic. `exec` keeps SIGTERM delivery correct on Render.
CMD ["sh", "-c", "node scripts/migrate.bundle.cjs && exec node server.js"]
