# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Production Dockerfile
# Multi-stage build with standalone Next.js output (~120 MB final image)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 0 ── Base with pnpm via corepack ──────────────────────────────────
FROM node:22-alpine AS base

# libc6-compat is required by some native Node modules on Alpine
RUN apk add --no-cache libc6-compat

# Enable corepack and prepare pinned pnpm version
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

# ── Stage 1 ── Install dependencies ────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy lockfile + manifests first (layer cache optimization)
COPY package.json pnpm-lock.yaml ./

# Frozen lockfile = deterministic installs
RUN pnpm install --frozen-lockfile --config.ignore-scripts=false

# ── Stage 2 ── Build the Next.js application ───────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the entire source tree
COPY . .

# ── Build-time arguments ──
ARG NEXT_PUBLIC_DOMAIN="localhost"
ARG NEXT_PUBLIC_APP_URL="http://localhost:5003"
ARG NEXT_PUBLIC_DATABASE_PROVIDER="turso"
ARG SELFHOSTED="true"

# Next.js inlines NEXT_PUBLIC_* only when present as ENV at build time.
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_DATABASE_PROVIDER=$NEXT_PUBLIC_DATABASE_PROVIDER
ENV SELFHOSTED=$SELFHOSTED

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application (produces .next/standalone with output: 'standalone')
RUN pnpm build

# ── Stage 3 ── Production runner (minimal) ─────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# OCI / container metadata labels
LABEL org.opencontainers.image.title="Kylrix"
LABEL org.opencontainers.image.description="Self-hosted Kylrix productivity platform"
LABEL org.opencontainers.image.url="https://kylrix.space"
LABEL org.opencontainers.image.source="https://github.com/Kylrix/kylrix"
LABEL org.opencontainers.image.vendor="Kylrix"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the standalone output (dramatically smaller than full node_modules)
# Next.js standalone includes a minimal server.js and only required dependencies
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets must be copied separately (not included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public directory (favicons, robots.txt, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Health check — lightweight curl-free check using Node itself
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({hostname:'127.0.0.1',port:3000,path:'/api/health',timeout:3000}, res => { process.exit(res.statusCode === 200 ? 0 : 1) }); req.on('error', () => process.exit(1)); req.end();"

# Run the standalone server directly (not via pnpm/npm — no package manager needed)
CMD ["node", "server.js"]
