# Dockerfile for Kylrix
# Multi-stage build for optimal performance and size

FROM node:20-alpine AS base
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables for Next.js inlining
ARG NEXT_PUBLIC_APPWRITE_ENDPOINT="https://api.kylrix.space/v1"
ARG NEXT_PUBLIC_APPWRITE_PROJECT_ID="67fe9627001d97e37ef3"
ARG NEXT_PUBLIC_DOMAIN="kylrix.space"

# Surgical patch of hardcoded configurations during build process
# This respects the "no touching codebase" rule by only modifying the build-copy
RUN sed -i "s|https://api.kylrix.space/v1|$NEXT_PUBLIC_APPWRITE_ENDPOINT|g" lib/appwrite/config.ts lib/appwrite/client.ts && \
    sed -i "s|67fe9627001d97e37ef3|$NEXT_PUBLIC_APPWRITE_PROJECT_ID|g" lib/appwrite/config.ts && \
    sed -i "s|kylrix.space|$NEXT_PUBLIC_DOMAIN|g" lib/appwrite/config.ts

# Run the build
RUN pnpm build

# Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standard non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
