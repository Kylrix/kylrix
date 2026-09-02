#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Autonomous 1-Command Self-Hosting Installer
#
# Spins up bundled Appwrite + MariaDB + Redis, mints a local project + API key,
# provisions schema, and launches Kylrix on APP_PORT (default 5003).
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

command -v git >/dev/null 2>&1 || {
  echo -e "${RED}Error: git is not installed.${NC}"
  exit 1
}

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo -e "${RED}Error: ${cmd} is required for self-host bootstrap.${NC}"
    exit 1
  }
done

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
  if [ -f "$REPO_ROOT/docker-compose.yml" ] && [ -f "$REPO_ROOT/selfhost/mint-env.sh" ]; then
    INSTALL_DIR="$REPO_ROOT"
  else
    INSTALL_DIR="$HOME/kylrix-selfhost"
  fi
fi
PORT="${KYLRIX_PORT:-5003}"
APPWRITE_PORT="${KYLRIX_APPWRITE_PORT:-8080}"

echo -e "Installing Kylrix into: ${CYAN}${INSTALL_DIR}${NC}"
echo -e "Application port:      ${CYAN}${PORT}${NC}"
echo -e "Appwrite API port:     ${CYAN}${APPWRITE_PORT}${NC}\n"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}Updating existing installation...${NC}"
  cd "$INSTALL_DIR"
  if [ "${KYLRIX_SKIP_GIT_PULL:-}" != "1" ]; then
    git fetch origin master
    git checkout master
    git pull origin master
  else
    echo -e "${YELLOW}Skipping git pull (KYLRIX_SKIP_GIT_PULL=1)${NC}"
  fi
elif [ -f "$INSTALL_DIR/docker-compose.yml" ] && [ -f "$INSTALL_DIR/selfhost/mint-env.sh" ]; then
  echo -e "${YELLOW}Using existing Kylrix tree at ${INSTALL_DIR}${NC}"
  cd "$INSTALL_DIR"
else
  if [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    echo -e "${RED}Error: ${INSTALL_DIR} exists but is not a Kylrix install. Remove it or set KYLRIX_DIR elsewhere.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}Cloning Kylrix repository...${NC}"
  mkdir -p "$INSTALL_DIR"
  git clone https://github.com/Kylrix/kylrix.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

if [ ! -f .env ]; then
  cp env.sample .env
fi

# Check command line flags
for arg in "$@"; do
  if [ "$arg" = "--with-backend" ] || [ "$arg" = "--backend" ]; then
    export BACKEND="true"
    export KYLRIX_BACKEND="true"
  elif [ "$arg" = "--standalone" ] || [ "$arg" = "--no-backend" ]; then
    export BACKEND="false"
    export KYLRIX_BACKEND="false"
  fi
done

capture_env_override BACKEND
capture_env_override KYLRIX_BACKEND
capture_env_override SELFHOST_ADMIN_EMAIL
capture_env_override SELFHOST_ADMIN_PASSWORD
capture_env_override SELFHOST_ADMIN_NAME
capture_env_override NEXT_PUBLIC_LOGGING_VERBOSE
USER_SET_ADMIN_PASSWORD=0
has_env_override SELFHOST_ADMIN_PASSWORD && USER_SET_ADMIN_PASSWORD=1

export APP_PORT="${PORT}"
export APPWRITE_PORT="${APPWRITE_PORT}"
export KYLRIX_DOMAIN="${KYLRIX_DOMAIN:-localhost}"
export KYLRIX_APPWRITE_DOMAIN="${KYLRIX_APPWRITE_DOMAIN:-localhost}"
export APPWRITE_UNSTABLE="${KYLRIX_APPWRITE_UNSTABLE:-${APPWRITE_UNSTABLE:-false}}"

eval "$(bash selfhost/detect-status.sh)"

if [ "${KYLRIX_CLOUD_BLEED:-0}" = "1" ]; then
  echo -e "${YELLOW}Detected cloud backend config — reminting for bundled self-host...${NC}"
fi

if [ ! -f .env ] || ! grep -qE '^APPWRITE_API_KEY=.+$' .env 2>/dev/null; then
  export KYLRIX_FORCE_LOCAL_PROJECT_ID=1
fi
bash selfhost/mint-env.sh
# Docker Compose prefers shell exports over .env — always reload from minted file.
# shellcheck source=selfhost/load-env.sh
source selfhost/load-env.sh .env
eval "$(bash selfhost/detect-status.sh)"

IS_INTEGRATED_BACKEND="${KYLRIX_INTEGRATED_BACKEND:-0}"

if [ "$IS_INTEGRATED_BACKEND" = "1" ]; then
  if [ "${KYLRIX_INFRA_READY:-0}" = "1" ]; then
    echo -e "\n${GREEN}✓ Appwrite infrastructure already running${NC}"
  else
    echo -e "\n${YELLOW}Starting Appwrite infrastructure (MariaDB, Redis, Appwrite)...${NC}"
    $COMPOSE_CMD up -d mariadb redis appwrite
  fi

  if [ "${KYLRIX_BOOTSTRAP_READY:-0}" = "1" ]; then
    echo -e "${GREEN}✓ Local Appwrite project already bootstrapped${NC}"
  else
    echo -e "\n${YELLOW}Bootstrapping local Appwrite project + API key...${NC}"
    bash selfhost/bootstrap.sh
  fi

  if [ "${KYLRIX_NEEDS_REBUILD:-0}" = "1" ]; then
    echo -e "\n${YELLOW}Rebuilding Kylrix for local Appwrite (client bundle must match .env)...${NC}"
    source selfhost/load-env.sh .env
    $COMPOSE_CMD up -d --build --force-recreate kylrix
    echo "${KYLRIX_CONFIG_STAMP:-}" > .selfhost-config-stamp
  elif [ "${KYLRIX_APP_RUNNING:-0}" = "1" ]; then
    echo -e "\n${GREEN}✓ Kylrix app already running with local config${NC}"
    $COMPOSE_CMD up -d kylrix
  else
    echo -e "\n${YELLOW}Building and launching Kylrix...${NC}"
    source selfhost/load-env.sh .env
    $COMPOSE_CMD up -d --build kylrix
    echo "${KYLRIX_CONFIG_STAMP:-}" > .selfhost-config-stamp
  fi

  if [ "${KYLRIX_SKIP_SCHEMA:-}" != "1" ]; then
    echo -e "\n${YELLOW}Provisioning Appwrite schema (tables, indexes, buckets)...${NC}"
    bash selfhost/provision-schema.sh || {
      echo -e "${YELLOW}Schema provisioning did not finish cleanly. Re-run: make schema-push${NC}"
    }
  fi

  source selfhost/load-env.sh .env

  echo -e "\n${GREEN}${BOLD}✓ Kylrix is self-hosted with integrated Appwrite backend${NC}"
  echo -e "App:              ${CYAN}${BOLD}http://localhost:${APP_PORT:-$PORT}${NC}"
  echo -e "Appwrite API:     ${CYAN}http://localhost:${APPWRITE_PORT}/v1${NC}"
  echo -e "Project ID:       ${CYAN}$(grep '^APPWRITE_PROJECT_ID=' .env | cut -d= -f2-)${NC}"
  echo -e "Admin email:      ${CYAN}${SELFHOST_ADMIN_EMAIL:-$(grep '^SELFHOST_ADMIN_EMAIL=' .env | cut -d= -f2-)}${NC}"
  if [ "${USER_SET_ADMIN_PASSWORD:-0}" = "1" ]; then
    echo -e "Admin password:   ${DIM}(from SELFHOST_ADMIN_PASSWORD)${NC}"
  else
    echo -e "Admin password:   ${CYAN}$(grep '^SELFHOST_ADMIN_PASSWORD=' .env | cut -d= -f2-)${NC}"
  fi
  echo ""
else
  echo -e "\n${GREEN}Deploying Kylrix in standalone application mode (BACKEND=false / default)...${NC}"
  source selfhost/load-env.sh .env
  $COMPOSE_CMD -f docker-compose.yml -f docker-compose.app-only.yml up -d --build kylrix

  echo -e "\n${GREEN}${BOLD}✓ Kylrix standalone application is running${NC}"
  echo -e "App:              ${CYAN}${BOLD}http://localhost:${APP_PORT:-$PORT}${NC}"
  echo -e "Backend:          ${YELLOW}Standalone Next.js (Appwrite self-host skipped; client/offline-first substrate active)${NC}"
  echo -e "Tip:              ${DIM}To enable bundled Appwrite backend, set BACKEND=true or run ./selfhost.sh --with-backend${NC}"
  echo ""
fi
