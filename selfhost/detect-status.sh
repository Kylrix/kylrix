#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Self-host status detection
# Emits shell assignments (eval "$(bash selfhost/detect-status.sh)") used by
# selfhost.sh to skip healthy steps and rebuild when config drifts to cloud.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

emit() { printf '%s=%q\n' "$1" "$2"; }

is_cloud_endpoint() {
  case "${1:-}" in
    *kylrix.space*|*api.kylrix*) return 0 ;;
  esac
  return 1
}

is_cloud_project_id() {
  local id="${1:-}"
  [ -z "$id" ] && return 1
  [ "$id" = "67fe9627001d97e37ef3" ] && return 0
  [[ "$id" =~ ^[0-9a-f]{24}$ ]] && return 0
  return 1
}

load_env() {
  [ -f "$ENV_FILE" ] || return 0
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
}

load_env

APP_PORT="${APP_PORT:-5003}"
APPWRITE_PORT="${APPWRITE_PORT:-8080}"
EXPECTED_ENDPOINT="http://localhost:${APPWRITE_PORT}/v1"
EXPECTED_PROJECT="${APPWRITE_PROJECT_ID:-}"
EXPECTED_DOMAIN="${KYLRIX_DOMAIN:-localhost}"

KYLRIX_CLOUD_BLEED=0
KYLRIX_INFRA_READY=0
KYLRIX_BOOTSTRAP_READY=0
KYLRIX_APP_RUNNING=0
KYLRIX_APP_HEALTHY=0
KYLRIX_NEEDS_REBUILD=0
KYLRIX_NEEDS_MINT=0

if is_cloud_endpoint "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}" \
  || is_cloud_endpoint "${APPWRITE_ENDPOINT:-}" \
  || [ "${DOMAIN:-}" = "kylrix.space" ] \
  || [ "${APPWRITE_DOMAIN:-}" = "kylrix.space" ] \
  || is_cloud_project_id "${APPWRITE_PROJECT_ID:-}" \
  || is_cloud_project_id "${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}"; then
  KYLRIX_CLOUD_BLEED=1
  KYLRIX_NEEDS_MINT=1
  KYLRIX_NEEDS_REBUILD=1
fi

if [ "${SELFHOSTED:-}" != "true" ]; then
  KYLRIX_NEEDS_MINT=1
fi

if [ "${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}" != "$EXPECTED_ENDPOINT" ] \
  || [ "${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}" != "$EXPECTED_PROJECT" ] \
  || [ "${DOMAIN:-}" != "$EXPECTED_DOMAIN" ]; then
  KYLRIX_NEEDS_MINT=1
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^kylrix-appwrite$'; then
  if docker inspect kylrix-appwrite --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
    KYLRIX_INFRA_READY=1
  elif docker inspect kylrix-appwrite --format '{{.State.Status}}' 2>/dev/null | grep -q running; then
    KYLRIX_INFRA_READY=1
  fi
fi

if [ -n "${APPWRITE_API_KEY:-}" ] && [ -n "$EXPECTED_PROJECT" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Appwrite-Project: ${EXPECTED_PROJECT}" \
    -H "X-Appwrite-Key: ${APPWRITE_API_KEY}" \
    "http://localhost:${APPWRITE_PORT}/v1/users?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    KYLRIX_BOOTSTRAP_READY=1
  fi
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^kylrix-app$'; then
  KYLRIX_APP_RUNNING=1
  RUNNING_ENDPOINT="$(docker exec kylrix-app printenv NEXT_PUBLIC_APPWRITE_ENDPOINT 2>/dev/null || true)"
  RUNNING_PROJECT="$(docker exec kylrix-app printenv APPWRITE_PROJECT_ID 2>/dev/null || true)"
  RUNNING_DOMAIN="$(docker exec kylrix-app printenv DOMAIN 2>/dev/null || true)"

  if is_cloud_endpoint "$RUNNING_ENDPOINT" \
    || is_cloud_project_id "$RUNNING_PROJECT" \
    || [ "$RUNNING_ENDPOINT" != "$EXPECTED_ENDPOINT" ] \
    || [ "$RUNNING_PROJECT" != "$EXPECTED_PROJECT" ] \
    || [ "$RUNNING_DOMAIN" = "kylrix.space" ]; then
    KYLRIX_NEEDS_REBUILD=1
  fi

  if docker inspect kylrix-app --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
    KYLRIX_APP_HEALTHY=1
  fi
fi

STAMP_FILE="${PROJECT_DIR}/.selfhost-config-stamp"
STAMP_PAYLOAD="$(printf '%s\n' \
  "$EXPECTED_ENDPOINT" \
  "$EXPECTED_PROJECT" \
  "$EXPECTED_DOMAIN" \
  "$(sha256sum "${PROJECT_DIR}/Dockerfile" "${PROJECT_DIR}/docker-compose.yml" 2>/dev/null | sha256sum | cut -d' ' -f1)")"
STAMP_NOW="$(printf '%s' "$STAMP_PAYLOAD" | sha256sum | cut -d' ' -f1)"
STAMP_PREV=""
[ -f "$STAMP_FILE" ] && STAMP_PREV="$(cat "$STAMP_FILE")"

if [ "$STAMP_NOW" != "$STAMP_PREV" ]; then
  KYLRIX_NEEDS_REBUILD=1
fi

emit KYLRIX_CLOUD_BLEED "$KYLRIX_CLOUD_BLEED"
emit KYLRIX_NEEDS_MINT "$KYLRIX_NEEDS_MINT"
emit KYLRIX_INFRA_READY "$KYLRIX_INFRA_READY"
emit KYLRIX_BOOTSTRAP_READY "$KYLRIX_BOOTSTRAP_READY"
emit KYLRIX_APP_RUNNING "$KYLRIX_APP_RUNNING"
emit KYLRIX_APP_HEALTHY "$KYLRIX_APP_HEALTHY"
emit KYLRIX_NEEDS_REBUILD "$KYLRIX_NEEDS_REBUILD"
emit KYLRIX_CONFIG_STAMP "$STAMP_NOW"
emit KYLRIX_EXPECTED_ENDPOINT "$EXPECTED_ENDPOINT"
emit KYLRIX_EXPECTED_PROJECT "$EXPECTED_PROJECT"
