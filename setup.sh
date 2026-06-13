#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Complete Setup Wizard (Self-Hosting & Contribution)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Colors & Formatting
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

gen_secret() {
    openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | xxd -p | tr -d '\n' || echo "kylrix_secure_default_secret_key_placeholder_$(date +%s)"
}

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

clear 2>/dev/null || true
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║           🏴 Kylrix Setup Wizard                 ║"
echo "  ╠══════════════════════════════════════════════════╣"
echo "  ║  One-click config for devs & self-hosters.       ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Port Check ──────────────────────────────────────────────────────────────
PORT=3005
PORT_BUSY=false

if command -v lsof &>/dev/null && lsof -i :3005 -t &>/dev/null; then
    PORT_BUSY=true
elif command -v ss &>/dev/null && ss -tuln | grep -q :3005; then
    PORT_BUSY=true
elif command -v netstat &>/dev/null && netstat -tuln | grep -q :3005; then
    PORT_BUSY=true
fi

if [ "$PORT_BUSY" = true ]; then
    warn "A process is already running on port 3005."
    echo -ne "  Are you already running a development version of Kylrix? (Y/n): "
    read -r ALREADY_RUNNING
    if [[ "$ALREADY_RUNNING" =~ ^[Nn]$ ]]; then
        prompt PORT "Enter a different port for Kylrix" "3006"
    fi
fi
echo ""

# ── Select Mode ──────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Select your deployment/development mode:${RESET}"
echo ""
echo -e "    ${CYAN}1${RESET}) ${BOLD}Contributor Mode (Kylrix Cloud)${RESET}"
echo -e "       - Zero-setup local development."
echo -e "       - Connects to the public Kylrix Cloud sandbox directly (localhost is pre-allowed)."
echo ""
echo -e "    ${CYAN}2${RESET}) ${BOLD}Zero-Setup SQLite Mode${RESET}"
echo -e "       - Runs completely offline without docker or remote endpoints."
echo -e "       - Stores data in a local 'sqlite.json' file."
echo ""
echo -e "    ${CYAN}3${RESET}) ${BOLD}Self-Host via Appwrite Cloud${RESET}"
echo -e "       - Connects to Appwrite Cloud (free tier). Schema deployed automatically."
echo ""
echo -e "    ${CYAN}4${RESET}) ${BOLD}Self-Host Local Appwrite (Docker)${RESET}"
echo -e "       - Provisions a complete local Docker Appwrite stack."
echo ""

prompt MODE "Choice" "1"
echo ""

# Defaults
DOMAIN="localhost"
APP_URL="http://localhost:${PORT}"
APPWRITE_ENDPOINT="https://api.kylrix.space/v1"
APPWRITE_PROJECT_ID="67fe9627001d97e37ef3"
DATABASE_PROVIDER="appwrite"
SELFHOST_MODE="false"
APPWRITE_API_KEY=""

if [ "$MODE" = "1" ]; then
    ok "Configuring Contributor Mode..."
    info "This will connect local Next.js dev server to the Kylrix public sandbox."
elif [ "$MODE" = "2" ]; then
    ok "Configuring Zero-Setup SQLite Mode..."
    DATABASE_PROVIDER="sqlite"
    SELFHOST_MODE="true"
elif [ "$MODE" = "3" ]; then
    ok "Configuring Appwrite Cloud Integration..."
    SELFHOST_MODE="true"
    DATABASE_PROVIDER="appwrite"
    APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1"
    
    # ── CLI Check & Onboarding ──
    if ! command -v appwrite &>/dev/null; then
        warn "Appwrite CLI is required to deploy database schemas automatically."
        echo -ne "  ${BOLD}Install Appwrite CLI globally now? (Y/n)${RESET}: "
        read -r INSTALL_CLI
        if [[ ! "$INSTALL_CLI" =~ ^[Nn]$ ]]; then
            info "Installing Appwrite CLI..."
            npm install -g appwrite-cli || sudo npm install -g appwrite-cli || true
        fi
    fi
    
    if command -v appwrite &>/dev/null; then
        info "Running Appwrite Login (Follow browser instructions)..."
        appwrite login || true
        
        echo ""
        info "Create a new project on Appwrite Cloud Console (https://cloud.appwrite.io)"
        prompt APPWRITE_PROJECT_ID "Appwrite Project ID" ""
        
        info "Generating API Key..."
        echo -e "  ${DIM}Go to Project → API Keys → Add API Key (Check all database, user, function scopes)${RESET}"
        prompt APPWRITE_API_KEY "Paste your API Key" ""
    else
        warn "Appwrite CLI not found. You will need to manually fill Project ID and API Key."
        prompt APPWRITE_PROJECT_ID "Appwrite Project ID" ""
        prompt APPWRITE_API_KEY "Appwrite API Key" ""
    fi
    
elif [ "$MODE" = "4" ]; then
    ok "Configuring Local Appwrite Stack..."
    SELFHOST_MODE="true"
    prompt DOMAIN "Local Domain" "localhost"
    prompt APP_URL "Kylrix Web App URL" "http://localhost:${PORT}"
    APPWRITE_ENDPOINT="http://localhost/v1"
    prompt APPWRITE_PROJECT_ID "Appwrite Project ID" "kylrix-local"
    prompt APPWRITE_API_KEY "Appwrite API Key" ""
fi

# Write environment configuration
INTERNAL_JOBS_SECRET="$(gen_secret 32)"
ATTACHMENT_SIGNING_SECRET="$(gen_secret 32)"

cat > "$ENV_FILE" << EOF
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix Environment Configuration
# Generated by setup.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ─────────────────────────────────────────────────────────────────────────────

# ── Core ──
PORT=${PORT}
NEXT_PUBLIC_APP_URL=${APP_URL}
NEXT_PUBLIC_APP_URI=${APP_URL}
NEXT_PUBLIC_ORIGIN=${APP_URL}
DOMAIN=${DOMAIN}

# ── Database ──
DATABASE_PROVIDER=${DATABASE_PROVIDER}
NEXT_PUBLIC_DATABASE_PROVIDER=${DATABASE_PROVIDER}

# ── Appwrite ──
APPWRITE_ENDPOINT=${APPWRITE_ENDPOINT}
NEXT_PUBLIC_APPWRITE_ENDPOINT=${APPWRITE_ENDPOINT}
APPWRITE_PROJECT_ID=${APPWRITE_PROJECT_ID}
NEXT_PUBLIC_APPWRITE_PROJECT_ID=${APPWRITE_PROJECT_ID}
APPWRITE_API_KEY=${APPWRITE_API_KEY}
APPWRITE_API=${APPWRITE_API_KEY}

# ── Security ──
SELFHOST_MODE=${SELFHOST_MODE}
KYLRIX_INTERNAL_JOBS_SECRET=${INTERNAL_JOBS_SECRET}
ATTACHMENT_URL_SIGNING_SECRET=${ATTACHMENT_SIGNING_SECRET}
ATTACHMENT_URL_TTL_SECONDS=300
AUTH_SUBDOMAIN=accounts

# ── Defaults ──
GOOGLE_API_KEY=
GEMINI_MODEL_NAME=gemini-2.5-flash-lite
NEXT_PUBLIC_NOTES_PAGE_SIZE=100
EOF

ok "Configuration successfully written to .env"
echo ""

# ── Auto-provision Database Schema ──────────────────────────────────────────
if [ "$MODE" = "3" ] || [ "$MODE" = "4" ]; then
    if [ -n "$APPWRITE_API_KEY" ]; then
        info "Provisioning Appwrite schema and databases..."
        bash "${PROJECT_DIR}/selfhost/provision-schema.sh" || warn "Schema auto-push failed. You can re-run 'make schema-push' later."
    else
        warn "No API Key provided. Skipping automated schema provisioning."
        info "Set APPWRITE_API_KEY in .env and run 'make schema-push' to configure database tables."
    fi
fi

# ── Dependency Installation ─────────────────────────────────────────────────
info "Detecting package managers..."
PKG_MGR="npm"
if command -v pnpm &>/dev/null; then
    PKG_MGR="pnpm"
elif command -v yarn &>/dev/null; then
    PKG_MGR="yarn"
fi

ok "Recommending: ${PKG_MGR}"
echo -ne "  ${BOLD}Install dependencies with ${PKG_MGR} now? (Y/n)${RESET}: "
read -r INSTALL_DEPS
if [[ ! "$INSTALL_DEPS" =~ ^[Nn]$ ]]; then
    info "Installing dependencies..."
    $PKG_MGR install
    ok "Dependencies installed successfully!"
fi

echo ""
echo -e "${BOLD}Setup Complete!${RESET}"
echo -e "Start the local Next.js dev server with:"
echo -e "  ${CYAN}${PKG_MGR} run dev${RESET}"
echo ""
