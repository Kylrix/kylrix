#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Appwrite image upgrade + migration
#
# Bumps APPWRITE_IMAGE (default 1.9.6), pulls, restarts Appwrite, runs migrate.
# For jumps from very old versions (e.g. 1.6.x), migration may fail — use:
#   make clean && make up && make schema-push
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
info() { echo -e "  ${CYAN}▸${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  fail "Missing .env — run selfhost/mint-env.sh first"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

bash "${SCRIPT_DIR}/mint-env.sh"

APPWRITE_IMAGE="${APPWRITE_IMAGE:-appwrite/appwrite:1.9.6}"
COMPOSE_CMD="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi

cd "$PROJECT_DIR"

echo ""
echo -e "${BOLD}Kylrix Appwrite Upgrade${RESET}"
echo -e "${DIM}Target image: ${APPWRITE_IMAGE}${RESET}"
echo ""

info "Stopping Kylrix + Appwrite..."
$COMPOSE_CMD stop kylrix appwrite 2>/dev/null || true

info "Pulling ${APPWRITE_IMAGE}..."
docker pull "$APPWRITE_IMAGE"

info "Starting MariaDB, Redis, Appwrite..."
$COMPOSE_CMD up -d mariadb redis appwrite

ENDPOINT="http://localhost:${APPWRITE_PORT:-8080}/v1"
info "Waiting for Appwrite at ${ENDPOINT}..."
for _ in $(seq 1 120); do
  if curl -fsS "${ENDPOINT}/health/version" >/dev/null 2>&1; then
    ok "Appwrite is healthy"
    break
  fi
  sleep 2
done

if ! curl -fsS "${ENDPOINT}/health/version" >/dev/null 2>&1; then
  fail "Appwrite did not become healthy after image upgrade"
  exit 1
fi

VERSION="$(curl -fsS "${ENDPOINT}/health/version" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')"
ok "Running Appwrite ${VERSION:-unknown}"

info "Running Appwrite database migration..."
if $COMPOSE_CMD exec -T appwrite migrate; then
  ok "Migration completed"
else
  warn "Migration failed — common when jumping multiple major versions (e.g. 1.6 → 1.9)."
  warn "For a clean slate: make clean && make up && make schema-push"
  exit 1
fi

info "Verifying bootstrap credentials..."
bash "${SCRIPT_DIR}/bootstrap.sh"

info "Rebuilding and starting Kylrix..."
$COMPOSE_CMD up -d --build kylrix

if [ "${KYLRIX_SKIP_SCHEMA:-}" != "1" ]; then
  info "Provisioning schema..."
  bash "${SCRIPT_DIR}/provision-schema.sh" || warn "Schema push did not finish cleanly — run: make schema-push"
fi

echo ""
ok "Appwrite upgrade complete (${APPWRITE_IMAGE})"
echo ""
