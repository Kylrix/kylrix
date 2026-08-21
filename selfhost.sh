#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Autonomous 1-Command Self-Hosting Installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
#   — or —
#   ./selfhost.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "  _  ____     _      ____  _____  __  __ "
echo " | |/ /\ \   / /    |  _ \|_   _| \ \/ / "
echo " | ' /  \ \ / /_____| |_) | | |    \  /  "
echo " | . \   \ V /|_____|  _ <  | |    /  \  "
echo " |_|\_\   |_|       |_| \_\ |_|   /_/\_\ "
echo -e "${NC}"
echo -e "${BOLD}Kylrix Autonomous Self-Hosting Installer${NC}\n"

# 1. Dependency checks
command -v docker >/dev/null 2>&1 || {
  echo -e "${RED}Error: docker is not installed.${NC} Please install Docker first: https://docs.docker.com/engine/install/"
  exit 1
}

command -v git >/dev/null 2>&1 || {
  echo -e "${RED}Error: git is not installed.${NC} Please install git."
  exit 1
}

# Check docker compose plugin
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}Error: docker compose is not installed.${NC}"
  exit 1
fi

INSTALL_DIR="${KYLRIX_DIR:-$HOME/kylrix-selfhost}"
PORT="${KYLRIX_PORT:-3006}"

echo -e "Installing Kylrix into: ${CYAN}${INSTALL_DIR}${NC}"
echo -e "Application port:      ${CYAN}${PORT}${NC}\n"

# 2. Clone or Update repository
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}Updating existing installation...${NC}"
  cd "$INSTALL_DIR"
  git fetch origin master
  git checkout master
  git pull origin master
else
  echo -e "${YELLOW}Cloning Kylrix repository...${NC}"
  mkdir -p "$INSTALL_DIR"
  git clone https://github.com/Kylrix/kylrix.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 3. Configure Environment
if [ ! -f .env ]; then
  echo -e "${YELLOW}Generating environment configuration (.env)...${NC}"
  cat <<ENV_EOF > .env
PORT=${PORT}
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
APP_PORT=${PORT}
DOMAIN=localhost
NEXT_PUBLIC_DOMAIN=localhost
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://api.kylrix.space/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=67fe9627001d97e37ef3
ENV_EOF
fi

# Ensure port mapping is configured
export APP_PORT="${PORT}"

# 4. Build & Start with Docker
echo -e "\n${YELLOW}Building and launching container stack...${NC}"
$COMPOSE_CMD -f docker-compose.yml up -d --build

echo -e "\n${GREEN}${BOLD}✓ Kylrix is self-hosted and running!${NC}"
echo -e "Access your instance at: ${CYAN}${BOLD}http://localhost:${PORT}${NC}\n"
