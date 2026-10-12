#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Interactive Self-Hosting Setup Wizard
# Generates a production-ready .env file with secure defaults.
# Safe to re-run: existing .env values are preserved unless you opt to reset.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors & Helpers ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

info()  { echo -e "  ${CYAN}▸${RESET} $1"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET} $1"; }
err()   { echo -e "  ${RED}✗${RESET} $1" >&2; }

prompt() {
    local varname="$1" label="$2" default="${3:-}"
    local value
    if [ -n "$default" ]; then
        echo -ne "  ${BOLD}${label}${RESET} ${DIM}[${default}]${RESET}: "
    else
        echo -ne "  ${BOLD}${label}${RESET}: "
    fi
    read -r value
    value="${value:-$default}"
    eval "$varname=\"\$value\""
}

prompt_secret() {
    local varname="$1" label="$2"
    echo -ne "  ${BOLD}${label}${RESET}: "
    read -rs value
    echo ""
    eval "$varname=\"\$value\""
}

gen_secret() {
    openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | xxd -p | tr -d '\n'
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

# ── Banner ──────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║           🏴 Kylrix Self-Hosting Setup           ║"
echo "  ╠══════════════════════════════════════════════════╣"
echo "  ║  Sovereign workspace. Your data. Your rules.    ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Prerequisites ───────────────────────────────────────────────────────────
echo -e "  ${BOLD}Checking prerequisites...${RESET}"
echo ""

HAS_DOCKER=false
HAS_COMPOSE=false

if command -v docker &>/dev/null; then
    ok "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
    HAS_DOCKER=true
elif command -v podman &>/dev/null; then
    ok "Podman $(podman --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
    HAS_DOCKER=true
else
    err "Docker or Podman is required. Install one and re-run."
    exit 1
fi

if docker compose version &>/dev/null; then
    ok "Docker Compose $(docker compose version --short 2>/dev/null || echo 'v2+')"
    HAS_COMPOSE=true
elif command -v docker-compose &>/dev/null; then
    ok "docker-compose $(docker-compose version --short 2>/dev/null || echo 'installed')"
    HAS_COMPOSE=true
elif command -v podman-compose &>/dev/null; then
    ok "podman-compose installed"
    HAS_COMPOSE=true
else
    err "Docker Compose (or podman-compose) is required."
    exit 1
fi

if command -v openssl &>/dev/null; then
    ok "OpenSSL available"
else
    warn "OpenSSL not found — using /dev/urandom for secret generation"
fi

echo ""

# ── Check for existing .env ─────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    warn "Existing .env found at ${ENV_FILE}"
    echo -ne "  ${BOLD}Overwrite with fresh config? (y/N)${RESET}: "
    read -r OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        ok "Keeping existing .env. Run 'make up' to start."
        exit 0
    fi
    cp "$ENV_FILE" "${ENV_FILE}.bak"
    ok "Backed up existing .env to .env.bak"
    echo ""
fi

# ── Deployment Mode ─────────────────────────────────────────────────────────
echo -e "  ${BOLD}─── Deployment Mode ───${RESET}"
echo ""
echo "  How would you like to deploy?"
echo ""
echo -e "    ${CYAN}1${RESET}) ${BOLD}Full Stack${RESET} — Kylrix + Appwrite + Database (recommended)"
echo -e "    ${CYAN}2${RESET}) ${BOLD}App Only${RESET}   — Kylrix only (bring your own Appwrite)"
echo ""
echo -ne "  ${BOLD}Choice${RESET} ${DIM}[1]${RESET}: "
read -r DEPLOY_MODE
DEPLOY_MODE="${DEPLOY_MODE:-1}"

echo ""

# ── Domain Configuration ────────────────────────────────────────────────────
echo -e "  ${BOLD}─── Domain Configuration ───${RESET}"
echo ""

prompt DOMAIN "Domain name" "localhost"
prompt APP_URL "Full app URL" "https://${DOMAIN}"

if [ "$DEPLOY_MODE" = "1" ]; then
    prompt APPWRITE_DOMAIN "Appwrite API subdomain" "api.${DOMAIN}"
    APPWRITE_ENDPOINT="https://${APPWRITE_DOMAIN}/v1"
    info "Appwrite endpoint: ${APPWRITE_ENDPOINT}"
else
    prompt APPWRITE_ENDPOINT "Appwrite endpoint URL" ""
    if [ -z "$APPWRITE_ENDPOINT" ]; then
        err "Appwrite endpoint is required in app-only mode."
        exit 1
    fi
    APPWRITE_DOMAIN=""
fi

echo ""

# ── Appwrite Project ────────────────────────────────────────────────────────
echo -e "  ${BOLD}─── Appwrite Project ───${RESET}"
echo ""

if [ "$DEPLOY_MODE" = "1" ]; then
    APPWRITE_PROJECT_ID="kylrix-$(gen_secret 4)"
    ok "Generated project ID: ${APPWRITE_PROJECT_ID}"
    info "You'll create this project in the Appwrite console after first boot."
else
    prompt APPWRITE_PROJECT_ID "Appwrite Project ID" ""
    if [ -z "$APPWRITE_PROJECT_ID" ]; then
        err "Project ID is required."
        exit 1
    fi
fi

echo ""
echo -e "  ${DIM}Appwrite API Key is needed to provision the database schema.${RESET}"
echo -e "  ${DIM}Create one in Appwrite Console → Project → API Keys (full access).${RESET}"
prompt APPWRITE_API_KEY "Appwrite API Key (server-side)" ""
if [ -z "$APPWRITE_API_KEY" ]; then
    warn "No API key provided. You can add it later to run schema provisioning."
fi

echo ""

# ── Admin & Security ────────────────────────────────────────────────────────
echo -e "  ${BOLD}─── Admin & Security ───${RESET}"
echo ""

prompt ADMIN_EMAIL "Admin email address" ""
prompt AUTH_SUBDOMAIN "Auth subdomain" "accounts"

# Generate secure secrets
INTERNAL_JOBS_SECRET="$(gen_secret 32)"
ATTACHMENT_SIGNING_SECRET="$(gen_secret 32)"
APPWRITE_OPENSSL_KEY="$(gen_secret 32)"
MARIADB_PASSWORD="$(gen_secret 16)"
MARIADB_ROOT_PASSWORD="$(gen_secret 16)"

ok "Generated KYLRIX_INTERNAL_JOBS_SECRET (64 chars)"
ok "Generated ATTACHMENT_URL_SIGNING_SECRET (64 chars)"
ok "Generated database passwords"

echo ""

# ── AI Features (Optional) ─────────────────────────────────────────────────
echo -e "  ${BOLD}─── AI Features (Optional) ───${RESET}"
echo ""
echo -e "  ${DIM}Power agentic workflows with Google Gemini. Skip to disable AI.${RESET}"
echo ""

prompt GOOGLE_API_KEY "Google API Key" ""
prompt GEMINI_MODEL_NAME "Gemini model name" "gemini-2.5-flash-lite"

echo ""

# ── Integrations (Optional) ────────────────────────────────────────────────
echo -e "  ${BOLD}─── Integrations (Optional) ───${RESET}"
echo ""
echo -e "  ${DIM}Press Enter to skip any integration.${RESET}"
echo ""

prompt CLOUDFLARE_TURNSTILE_SECRET "Cloudflare Turnstile secret key" ""
prompt CLOUDFLARE_TURNSTILE_KEY "Cloudflare Turnstile site key" ""
prompt TELEGRAM_BOT_API "Telegram Bot API token" ""

echo ""

# ── Write .env ──────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Writing configuration...${RESET}"
echo ""

cat > "$ENV_FILE" << ENVEOF
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix Self-Hosted Configuration
# Generated by setup.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ─────────────────────────────────────────────────────────────────────────────

# ── Core ─────────────────────────────────────────────────────────────────────
# Appwrite server SDK key (used for server-side operations)
APPWRITE_API=${APPWRITE_API_KEY}
# The public URL where Kylrix is accessible
NEXT_PUBLIC_APP_URL=${APP_URL}
NEXT_PUBLIC_APP_URI=${APP_URL}
NEXT_PUBLIC_ORIGIN=${APP_URL}
# Your base domain (used for cookies, passkey RP ID, and security context)
DOMAIN=${DOMAIN}

# ── Appwrite (Build-Time) ────────────────────────────────────────────────────
# These are passed as Docker build args and patched into the source at build time.
APPWRITE_ENDPOINT=${APPWRITE_ENDPOINT}
APPWRITE_PROJECT_ID=${APPWRITE_PROJECT_ID}
APPWRITE_DOMAIN=${APPWRITE_DOMAIN}

# ── Appwrite (Self-Hosted Infrastructure) ────────────────────────────────────
APPWRITE_OPENSSL_KEY=${APPWRITE_OPENSSL_KEY}
MARIADB_USER=appwrite
MARIADB_PASSWORD=${MARIADB_PASSWORD}
MARIADB_ROOT_PASSWORD=${MARIADB_ROOT_PASSWORD}

# ── Self-Hosting ─────────────────────────────────────────────────────────────
# Server SDK API key for schema provisioning (same as APPWRITE_API)
APPWRITE_API_KEY=${APPWRITE_API_KEY}
# Mark this as a self-hosted instance
SELFHOST_MODE=true

# ── Security ─────────────────────────────────────────────────────────────────
# Admin emails (comma-separated) — these users get admin panel access
ADMINS=${ADMIN_EMAIL}
# Internal jobs authentication secret (min 32 chars, never expose to client)
KYLRIX_INTERNAL_JOBS_SECRET=${INTERNAL_JOBS_SECRET}
# HMAC key for signed attachment URLs
ATTACHMENT_URL_SIGNING_SECRET=${ATTACHMENT_SIGNING_SECRET}
# Signed URL TTL in seconds
ATTACHMENT_URL_TTL_SECONDS=300
# Auth subdomain (for passkey RP and cookie scoping)
AUTH_SUBDOMAIN=${AUTH_SUBDOMAIN}

# ── AI / Agentic ─────────────────────────────────────────────────────────────
# Google Gemini API key (optional — enables AI agent features)
GOOGLE_API_KEY=${GOOGLE_API_KEY}
# Model name (e.g. gemini-2.5-flash-lite, gemini-1.5-pro)
GEMINI_MODEL_NAME=${GEMINI_MODEL_NAME}

# ── Integrations (Optional) ──────────────────────────────────────────────────
# Cloudflare Turnstile (bot protection on auth flows)
CLOUDFLARE_TURNSTILE_SECRET=${CLOUDFLARE_TURNSTILE_SECRET}
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_KEY=${CLOUDFLARE_TURNSTILE_KEY}
# Telegram Bot (push notifications via Telegram)
TELEGRAM_BOT_API=${TELEGRAM_BOT_API}
# Cloudflare API (DNS management, optional)
CLOUDFLARE_API=
# BlockBee (crypto payments for Kylrix Pro, optional)
BLOCKBEE_API=
BLOCKBEE_WEBHOOK_PUBLIC_KEY_PEM=
BLOCKBEE_ALLOW_UNSIGNED_WEBHOOKS=

# ── Tuning ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_NOTES_PAGE_SIZE=100
NEXT_PUBLIC_LOGGING_VERBOSE=
ENVEOF

ok "Configuration written to .env"

echo ""

# ── Summary ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║            ✓  Setup Complete                     ║"
echo "  ╠══════════════════════════════════════════════════╣"
echo -e "  ║  Domain:   ${DOMAIN}$(printf '%*s' $((35 - ${#DOMAIN})) '')║"
echo -e "  ║  Mode:     $([ "$DEPLOY_MODE" = "1" ] && echo "Full Stack" || echo "App Only  ")$(printf '%*s' 25 '')║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

echo -e "  ${BOLD}Next steps:${RESET}"
echo ""

if [ "$DEPLOY_MODE" = "1" ]; then
    echo -e "    ${CYAN}1.${RESET} Start the full stack:"
    echo -e "       ${DIM}\$ make up${RESET}"
    echo ""
    echo -e "    ${CYAN}2.${RESET} Open the Appwrite console at https://${APPWRITE_DOMAIN}"
    echo -e "       Create project ID: ${BOLD}${APPWRITE_PROJECT_ID}${RESET}"
    echo -e "       Add web platform: ${BOLD}${DOMAIN}${RESET}"
    echo ""
    echo -e "    ${CYAN}3.${RESET} Provision the database schema:"
    echo -e "       ${DIM}\$ make schema-push${RESET}"
    echo ""
    echo -e "    ${CYAN}4.${RESET} Open ${BOLD}${APP_URL}${RESET} and create your account"
else
    echo -e "    ${CYAN}1.${RESET} Ensure Appwrite at ${BOLD}${APPWRITE_ENDPOINT}${RESET} is reachable"
    echo -e "       and project ${BOLD}${APPWRITE_PROJECT_ID}${RESET} has ${BOLD}${DOMAIN}${RESET} as a web platform"
    echo ""
    echo -e "    ${CYAN}2.${RESET} Start the app:"
    echo -e "       ${DIM}\$ make app-only${RESET}"
    echo ""
    echo -e "    ${CYAN}3.${RESET} Provision the schema (if first time):"
    echo -e "       ${DIM}\$ make schema-push${RESET}"
fi

echo ""
echo -e "  ${DIM}Config file: ${ENV_FILE}${RESET}"
echo -e "  ${DIM}Re-run this script anytime to reconfigure.${RESET}"
echo ""
