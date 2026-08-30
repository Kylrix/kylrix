#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Appwrite Bootstrap
# Waits for bundled Appwrite, registers the local admin, mints project + API key,
# registers the web platform, and writes credentials into .env.
# Idempotent: skips steps that already succeeded.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $1" >&2; }
info() { echo -e "  ${CYAN}▸${RESET} $1" >&2; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1" >&2; }
fail() { echo -e "  ${RED}✗${RESET} $1" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { fail "'$cmd' is required"; exit 1; }
done

if [ ! -f "$ENV_FILE" ]; then
  fail "Missing .env — run selfhost/mint-env.sh first"
  exit 1
fi

load_env() {
  set -a
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      val="${val%\"}"; val="${val#\"}"
      val="${val%\'}"; val="${val#\'}"
      export "$key=$val"
    fi
  done < "$ENV_FILE"
  set +a
}

load_env

APPWRITE_PORT="${APPWRITE_PORT:-8080}"
APPWRITE_HOST="${APPWRITE_BOOTSTRAP_HOST:-localhost}"
ENDPOINT="http://${APPWRITE_HOST}:${APPWRITE_PORT}/v1"
DOMAIN="${DOMAIN:-localhost}"
APP_PORT="${APP_PORT:-5003}"
PROJECT_ID="${APPWRITE_PROJECT_ID:-}"
ADMIN_EMAIL="${SELFHOST_ADMIN_EMAIL:-admin@${DOMAIN}}"
ADMIN_PASSWORD="${SELFHOST_ADMIN_PASSWORD:-}"
ADMIN_NAME="${SELFHOST_ADMIN_NAME:-Kylrix Admin}"
COOKIE_JAR="$(mktemp)"
CONSOLE_JWT=""
trap 'rm -f "$COOKIE_JAR"' EXIT

if [ -z "$PROJECT_ID" ]; then
  fail "APPWRITE_PROJECT_ID is empty — run selfhost/mint-env.sh"
  exit 1
fi

if [ -n "${APPWRITE_API_KEY:-}" ] && [ -n "${APPWRITE_API:-}" ]; then
  info "Appwrite credentials already present in .env — verifying..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Appwrite-Project: ${PROJECT_ID}" \
    -H "X-Appwrite-Key: ${APPWRITE_API_KEY}" \
    "${ENDPOINT}/users?limit=1")
  if [ "$HTTP_CODE" = "200" ]; then
    ensure_kylrix_app_user
    ok "Existing Appwrite project + API key verified"
    exit 0
  fi
  warn "Stored API key did not verify — re-bootstrapping"
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sS -X "$method" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: ${CONSOLE_PROJECT_ID}" \
    "$@" \
    "${ENDPOINT}${path}"
}

api_admin() {
  local method="$1"
  local path="$2"
  shift 2
  if [ -z "$CONSOLE_JWT" ]; then
    fail "Console JWT missing — cannot perform admin API call to ${path}"
    exit 1
  fi
  curl -sS -X "$method" \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: ${CONSOLE_PROJECT_ID}" \
    -H "X-Appwrite-JWT: ${CONSOLE_JWT}" \
    "$@" \
    "${ENDPOINT}${path}"
}

wait_for_appwrite() {
  info "Waiting for Appwrite at ${ENDPOINT}..."
  for _ in $(seq 1 90); do
    if curl -fsS "${ENDPOINT}/health/version" >/dev/null 2>&1; then
      ok "Appwrite is healthy"
      return 0
    fi
    sleep 2
  done
  fail "Appwrite did not become healthy in time"
  exit 1
}

discover_console_project() {
  # Appwrite 1.6 self-hosted uses the literal "console" project for auth/bootstrap APIs.
  echo "console"
}

ensure_admin_session() {
  info "Ensuring local Appwrite admin account (${ADMIN_EMAIL})..."

  local register_code login_body
  register_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "X-Appwrite-Project: ${CONSOLE_PROJECT_ID}" \
    -d "{\"userId\":\"unique()\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"${ADMIN_NAME}\"}" \
    "${ENDPOINT}/account")

  if [ "$register_code" = "201" ]; then
    ok "Registered Appwrite admin account"
  elif [ "$register_code" = "409" ]; then
    info "Admin account already exists"
  else
    warn "Account register returned HTTP ${register_code} (continuing to login)"
  fi

  login_body=$(api POST "/account/sessions/email" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

  if ! echo "$login_body" | jq -e '."$id"' >/dev/null 2>&1; then
    fail "Failed to login Appwrite admin: ${login_body}"
    exit 1
  fi
  ok "Authenticated Appwrite admin session"
}

ensure_console_jwt() {
  local jwt_body
  jwt_body=$(api POST "/account/jwts")
  CONSOLE_JWT=$(echo "$jwt_body" | jq -r '.jwt // empty')
  if [ -z "$CONSOLE_JWT" ]; then
    fail "Failed to mint console JWT for admin APIs: ${jwt_body}"
    exit 1
  fi
  ok "Minted console JWT for project admin APIs"
}

ensure_team_id() {
  local teams_body team_id
  teams_body=$(api GET "/teams")
  team_id=$(echo "$teams_body" | jq -r '.teams[0]["$id"] // empty')
  if [ -n "$team_id" ]; then
    echo "$team_id"
    return 0
  fi

  team_id="kylrix-team-$(date +%s)"
  local create_body
  create_body=$(api POST "/teams" -d "{\"teamId\":\"${team_id}\",\"name\":\"Kylrix\"}")
  team_id=$(echo "$create_body" | jq -r '.["$id"] // empty')
  if [ -z "$team_id" ]; then
    fail "Failed to create Appwrite team: ${create_body}"
    exit 1
  fi
  ok "Created Appwrite team ${team_id}"
  echo "$team_id"
}

ensure_project() {
  local team_id="$1"
  local existing_body
  existing_body=$(api GET "/projects/${PROJECT_ID}" 2>/dev/null || true)

  if echo "$existing_body" | jq -e '.["$id"]' >/dev/null 2>&1; then
    ok "Appwrite project ${PROJECT_ID} already exists"
    return 0
  fi

  local create_body
  create_body=$(api POST "/projects" \
    -d "{\"projectId\":\"${PROJECT_ID}\",\"name\":\"Kylrix\",\"teamId\":\"${team_id}\",\"region\":\"default\"}")

  if echo "$create_body" | jq -e '.["$id"]' >/dev/null 2>&1; then
    ok "Created Appwrite project ${PROJECT_ID}"
    return 0
  fi

  if echo "$create_body" | grep -q 'project_already_exists'; then
    ok "Appwrite project ${PROJECT_ID} already exists"
    return 0
  fi

  fail "Failed to create Appwrite project: ${create_body}"
  exit 1
}

create_api_key() {
  local scopes_json key_body secret
  scopes_json='["sessions.write","users.read","users.write","teams.read","teams.write","databases.read","databases.write","tables.read","tables.write","columns.read","columns.write","indexes.read","indexes.write","rows.read","rows.write","collections.read","collections.write","attributes.read","attributes.write","documents.read","documents.write","files.read","files.write","buckets.read","buckets.write","functions.read","functions.write","executions.read","executions.write","locale.read","avatars.read","health.read","providers.read","providers.write","messages.read","messages.write","topics.read","topics.write","subscribers.read","subscribers.write","targets.read","targets.write","rules.read","rules.write","migrations.read","migrations.write","vcs.read","vcs.write","assistant.read"]'

  key_body=$(api POST "/projects/${PROJECT_ID}/keys" \
    -d "{\"keyId\":\"unique()\",\"name\":\"Kylrix Server\",\"scopes\":${scopes_json}}")

  secret=$(echo "$key_body" | jq -r '.secret // empty')
  if [ -z "$secret" ]; then
    fail "Failed to mint Appwrite API key: ${key_body}"
    exit 1
  fi

  upsert_env "APPWRITE_API_KEY" "$secret"
  upsert_env "APPWRITE_API" "$secret"
  ok "Minted Appwrite API key"
}

register_platform() {
  local body
  body=$(api POST "/projects/${PROJECT_ID}/platforms" \
    -d "{\"platformId\":\"unique()\",\"name\":\"Kylrix Web\",\"type\":\"web\",\"hostname\":\"${DOMAIN}\"}" || true)

  if echo "$body" | jq -e '.["$id"]' >/dev/null 2>&1; then
    ok "Registered web platform ${DOMAIN}"
  elif echo "$body" | grep -qi 'already exists'; then
    ok "Web platform ${DOMAIN} already registered"
  else
    warn "Platform registration response: ${body}"
  fi
}

ensure_kylrix_app_user() {
  if [ -z "${APPWRITE_API_KEY:-}" ]; then
    warn "APPWRITE_API_KEY missing — skipping Kylrix app user provisioning"
    return 0
  fi

  info "Ensuring Kylrix app login user (${ADMIN_EMAIL})..."

  local list_body create_body
  list_body=$(curl -sS \
    -H "X-Appwrite-Project: ${PROJECT_ID}" \
    -H "X-Appwrite-Key: ${APPWRITE_API_KEY}" \
    "${ENDPOINT}/users?queries%5B0%5D=equal(%22email%22,%5B%22${ADMIN_EMAIL}%22%5D)&limit=1")

  if echo "$list_body" | jq -e '.total > 0' >/dev/null 2>&1; then
    ok "Kylrix app user ${ADMIN_EMAIL} already exists"
    return 0
  fi

  create_body=$(curl -sS -X POST \
    -H "X-Appwrite-Project: ${PROJECT_ID}" \
    -H "X-Appwrite-Key: ${APPWRITE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"unique()\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"${ADMIN_NAME}\"}" \
    "${ENDPOINT}/users")

  if echo "$create_body" | jq -e '.email' >/dev/null 2>&1; then
    ok "Created Kylrix app user ${ADMIN_EMAIL}"
  else
    warn "Could not create Kylrix app user: ${create_body}"
  fi
}

echo ""
echo -e "${BOLD}Kylrix Appwrite Bootstrap${RESET}"
echo ""

wait_for_appwrite
CONSOLE_PROJECT_ID="$(discover_console_project)"
info "Console project: ${CONSOLE_PROJECT_ID}"

ensure_admin_session
TEAM_ID="$(ensure_team_id)"
ensure_project "$TEAM_ID"
create_api_key
register_platform
load_env
ensure_kylrix_app_user

upsert_env "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$PROJECT_ID"
upsert_env "NEXT_PUBLIC_APPWRITE_ENDPOINT" "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-http://localhost:${APPWRITE_PORT}/v1}"

echo ""
ok "Bootstrap complete — local Appwrite project ${PROJECT_ID} is ready"
echo -e "  ${DIM}Admin console: http://${APPWRITE_HOST}:${APPWRITE_PORT}${RESET}"
echo -e "  ${DIM}Admin email:     ${ADMIN_EMAIL}${RESET}"
echo -e "  ${DIM}Admin password:  ${ADMIN_PASSWORD}${RESET}"
echo ""
