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
# These are used ONLY during `docker build` to patch hardcoded values
# in the source copy. The original source files on disk are never touched.
ARG NEXT_PUBLIC_APPWRITE_ENDPOINT="http://localhost:8080/v1"
ARG NEXT_PUBLIC_APPWRITE_PROJECT_ID=""
ARG NEXT_PUBLIC_DOMAIN="localhost"
ARG SELFHOSTED="true"
ARG AUTH_EMAIL_PASSWORD_SIGNUP="false"
ARG AUTH_PASSKEY_SIGNUP="false"
ARG AUTH_PASSWORDLESS_MODE="false"

# Next.js inlines NEXT_PUBLIC_* only when present as ENV at build time.
ENV NEXT_PUBLIC_APPWRITE_ENDPOINT=$NEXT_PUBLIC_APPWRITE_ENDPOINT
ENV NEXT_PUBLIC_APPWRITE_PROJECT_ID=$NEXT_PUBLIC_APPWRITE_PROJECT_ID
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV SELFHOSTED=$SELFHOSTED
ENV AUTH_EMAIL_PASSWORD_SIGNUP=$AUTH_EMAIL_PASSWORD_SIGNUP
ENV AUTH_PASSKEY_SIGNUP=$AUTH_PASSKEY_SIGNUP
ENV AUTH_PASSWORDLESS_MODE=$AUTH_PASSWORDLESS_MODE

# ── Surgical sed-patching of hardcoded config values ──
# Patches are idempotent: if the value already matches, sed is a no-op.
# We patch three targets:
#   1. lib/appwrite/config.ts  — ENDPOINT, PROJECT_ID, DOMAIN
#   2. lib/appwrite/client.ts  — hardcoded endpoint on line ~10
#
# Guard: only run sed if the build arg differs from the hardcoded default.
# This avoids corrupting files when building with stock values.
RUN set -eux; \
    # ── Patch Appwrite endpoint ──
    if [ "$NEXT_PUBLIC_APPWRITE_ENDPOINT" != "https://api.kylrix.space/v1" ]; then \
      sed -i "s|https://api.kylrix.space/v1|${NEXT_PUBLIC_APPWRITE_ENDPOINT}|g" \
        lib/appwrite/config.ts \
        lib/appwrite/client.ts \
        app/layout.tsx \
        components/ui/NoteCard.tsx; \
    fi; \
    # ── Patch Appwrite project ID ──
    if [ "$NEXT_PUBLIC_APPWRITE_PROJECT_ID" != "67fe9627001d97e37ef3" ]; then \
      sed -i "s|67fe9627001d97e37ef3|${NEXT_PUBLIC_APPWRITE_PROJECT_ID}|g" \
        lib/appwrite/config.ts \
        components/ui/NoteCard.tsx; \
    fi; \
    # ── Patch domain ──
    if [ "$NEXT_PUBLIC_DOMAIN" != "kylrix.space" ]; then \
      sed -i "s|kylrix\.space|${NEXT_PUBLIC_DOMAIN}|g" \
        lib/appwrite/config.ts; \
    fi

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
