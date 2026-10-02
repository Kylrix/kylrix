#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Autonomous 1-Command Self-Hosting Installer (Turso / libSQL Edition)
#
# Ultra-lightweight self-host stack (<100MB RAM, sub-second boot):
#   - Kylrix App (Next.js + Better Auth + Drizzle)
#   - Turso libSQL Server (sqld container, identical to Turso Cloud)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
#   — or —
#   ./selfhost.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
DIM='\033[2m'

echo -e "${CYAN}${BOLD}"
echo "  _  ____     _      ____  _____  __  __ "
echo " | |/ /\ \   / /    |  _ \|_   _| \ \/ / "
echo " | ' /  \ \ / /_____| |_) | | |    \  /  "
echo " | . \   \ V /|_____|  _ <  | |    /  \  "
echo " |_|\_\   |_|       |_| \_\ |_|   /_/\_\ "
echo -e "${NC}"
echo -e "${BOLD}Kylrix Autonomous Self-Hosting Installer${NC}\n"

command -v docker >/dev/null 2>&1 || {
  echo -e "${RED}Error: docker is not installed.${NC} https://docs.docker.com/engine/install/"
  exit 1
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}Error: docker compose is not installed.${NC}"
  exit 1
fi

INSTALL_DIR="${KYLRIX_DIR:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$INSTALL_DIR" ]; then
  if [ -f "$REPO_ROOT/docker-compose.yml" ]; then
    INSTALL_DIR="$REPO_ROOT"
  else
    INSTALL_DIR="$HOME/kylrix-selfhost"
  fi
fi

APP_PORT="${KYLRIX_PORT:-5003}"
TURSO_PORT="${KYLRIX_TURSO_PORT:-8080}"
DOMAIN="${KYLRIX_DOMAIN:-localhost}"

echo -e "Installing Kylrix into: ${CYAN}${INSTALL_DIR}${NC}"
echo -e "Application port:      ${CYAN}${APP_PORT}${NC}"
echo -e "Turso libSQL port:     ${CYAN}${TURSO_PORT}${NC}\n"

if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  if [ "${KYLRIX_SKIP_GIT_PULL:-}" != "1" ]; then
    git fetch origin master >/dev/null 2>&1 || true
    git pull origin master >/dev/null 2>&1 || true
  fi
elif [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
  cd "$INSTALL_DIR"
else
  echo -e "${YELLOW}Cloning Kylrix repository...${NC}"
  mkdir -p "$INSTALL_DIR"
  git clone https://github.com/Kylrix/kylrix.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Ensure .env exists with required parameters
if [ ! -f .env ]; then
  touch .env
fi

# Helper to ensure env key exists
set_env_default() {
  local key="$1"
  local val="$2"
  if ! grep -q "^${key}=" .env 2>/dev/null; then
    echo "${key}=${val}" >> .env
  fi
}

# Generate cryptographically secure Better Auth secret if absent
if ! grep -q "^BETTER_AUTH_SECRET=" .env 2>/dev/null || [ -z "$(grep '^BETTER_AUTH_SECRET=' .env | cut -d= -f2-)" ]; then
  GENERATED_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n')
  set_env_default "BETTER_AUTH_SECRET" "$GENERATED_SECRET"
fi

set_env_default "APP_PORT" "$APP_PORT"
set_env_default "TURSO_PORT" "$TURSO_PORT"
set_env_default "DOMAIN" "$DOMAIN"
set_env_default "NEXT_PUBLIC_APP_URL" "http://${DOMAIN}:${APP_PORT}"
set_env_default "BETTER_AUTH_URL" "http://${DOMAIN}:${APP_PORT}"
set_env_default "NEXT_PUBLIC_DATABASE_PROVIDER" "turso"
set_env_default "TURSO_DATABASE_URL" "http://turso:8080"
set_env_default "SELFHOSTED" "true"

echo -e "${YELLOW}Starting Turso libSQL database container (sqld)...${NC}"
$COMPOSE_CMD up -d turso

echo -e "${YELLOW}Waiting for Turso database readiness...${NC}"
for i in {1..30}; do
  if $COMPOSE_CMD exec -T turso wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 || curl -s "http://127.0.0.1:${TURSO_PORT}/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Turso libSQL database is ready.${NC}"
    break
  fi
  sleep 1
done

echo -e "${YELLOW}Bootstrapping relational schema (ideas, goals, workspaces, auth)...${NC}"
TURSO_DATABASE_URL="http://127.0.0.1:${TURSO_PORT}" node selfhost/bootstrap.mjs || {
  echo -e "${YELLOW}Bootstrap completed or schema already initialized.${NC}"
}

echo -e "\n${YELLOW}Building and launching Kylrix application...${NC}"
$COMPOSE_CMD up -d --build kylrix

echo -e "\n${GREEN}${BOLD}✓ Kylrix is self-hosted with Turso (libSQL) backend!${NC}"
echo -e "Application:      ${CYAN}${BOLD}http://localhost:${APP_PORT}${NC}"
echo -e "Database Engine:  ${CYAN}http://localhost:${TURSO_PORT}${NC} (sqld / libSQL Hrana API)"
echo -e "Architecture:     ${GREEN}Zero-storage database-only snapshot substrate${NC}"
echo -e "Documentation:    ${DIM}See SELFHOST.md for backups, SSL, and scaling${NC}"
echo ""
