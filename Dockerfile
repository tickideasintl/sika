# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:24.21.0-alpine AS base
WORKDIR /app

# Install libc6-compat for Alpine compatibility
RUN apk add --no-cache libc6-compat

# ---- Dependencies ----
FROM base AS deps

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# ---- Migrator (full source + drizzle-kit, no Next build) ----
FROM base AS migrator
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---- Builder ----
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
# These should be provided at build time via Dokploy
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output and static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration/startup gate assets
COPY --from=migrator --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=migrator --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=migrator --chown=nextjs:nodejs /app/db/schema.ts ./db/schema.ts
COPY --from=migrator --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=migrator --chown=nextjs:nodejs /app/scripts/auto-migrate.mjs ./auto-migrate.mjs
COPY --from=migrator --chown=nextjs:nodejs /app/scripts/verify-db-schema.mjs ./verify-db-schema.mjs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node auto-migrate.mjs && node verify-db-schema.mjs && node server.js"]
