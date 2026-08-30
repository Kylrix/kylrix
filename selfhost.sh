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

INSTALL_DIR="${KYLRIX_DIR:-$HOME/kylrix-selfhost}"
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

export APP_PORT="${PORT}"
export APPWRITE_PORT="${APPWRITE_PORT}"
export KYLRIX_DOMAIN="${KYLRIX_DOMAIN:-localhost}"
export APPWRITE_UNSTABLE="${KYLRIX_APPWRITE_UNSTABLE:-${APPWRITE_UNSTABLE:-false}}"
if [ ! -f .env ] || ! grep -qE '^APPWRITE_API_KEY=.+$' .env 2>/dev/null; then
  export KYLRIX_FORCE_LOCAL_PROJECT_ID=1
fi
bash selfhost/mint-env.sh

echo -e "\n${YELLOW}Starting Appwrite infrastructure (MariaDB, Redis, Appwrite)...${NC}"
$COMPOSE_CMD up -d mariadb redis appwrite

echo -e "\n${YELLOW}Bootstrapping local Appwrite project + API key...${NC}"
bash selfhost/bootstrap.sh

echo -e "\n${YELLOW}Building and launching Kylrix...${NC}"
$COMPOSE_CMD up -d --build kylrix

if [ "${KYLRIX_SKIP_SCHEMA:-}" != "1" ]; then
  echo -e "\n${YELLOW}Provisioning Appwrite schema (tables, indexes, buckets)...${NC}"
  bash selfhost/provision-schema.sh || {
    echo -e "${YELLOW}Schema provisioning did not finish cleanly. Re-run: make schema-push${NC}"
  }
fi

echo -e "\n${GREEN}${BOLD}✓ Kylrix is self-hosted on your machine${NC}"
echo -e "App:              ${CYAN}${BOLD}http://localhost:${PORT}${NC}"
echo -e "Appwrite API:     ${CYAN}http://localhost:${APPWRITE_PORT}/v1${NC}"
echo -e "Project ID:       ${CYAN}$(grep '^APPWRITE_PROJECT_ID=' .env | cut -d= -f2-)${NC}\n"
echo -e "${DIM}Admin credentials are in .env (SELFHOST_ADMIN_EMAIL / SELFHOST_ADMIN_PASSWORD)${NC}\n"
