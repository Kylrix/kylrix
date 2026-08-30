#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Mint self-host environment (non-interactive)
# Generates local Appwrite project ID, secrets, and public endpoint URLs.
# Safe to re-run: preserves existing APPWRITE_PROJECT_ID / API key when set.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

gen_secret() {
  openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | xxd -p | tr -d '\n'
}

if [ ! -f "$ENV_FILE" ]; then
  cp "${PROJECT_DIR}/env.sample" "$ENV_FILE"
fi

if [ -f "$ENV_FILE" ]; then
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
fi

APP_PORT="${APP_PORT:-5003}"
APPWRITE_PORT="${APPWRITE_PORT:-8080}"
DOMAIN="${KYLRIX_DOMAIN:-${DOMAIN:-localhost}}"
PUBLIC_APPWRITE_ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-http://localhost:${APPWRITE_PORT}/v1}"
PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:${APP_PORT}}"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

upsert_env "APP_PORT" "$APP_PORT"
upsert_env "APPWRITE_PORT" "$APPWRITE_PORT"
upsert_env "DOMAIN" "$DOMAIN"
upsert_env "APPWRITE_DOMAIN" "${APPWRITE_DOMAIN:-$DOMAIN}"
upsert_env "APPWRITE_FUNCTIONS_DOMAIN" "${APPWRITE_FUNCTIONS_DOMAIN:-functions.localhost}"
upsert_env "APPWRITE_ENDPOINT" "http://appwrite/v1"
upsert_env "NEXT_PUBLIC_APPWRITE_ENDPOINT" "$PUBLIC_APPWRITE_ENDPOINT"
upsert_env "NEXT_PUBLIC_APP_URL" "$PUBLIC_APP_URL"
upsert_env "NEXT_PUBLIC_APP_URI" "$PUBLIC_APP_URL"
upsert_env "NEXT_PUBLIC_ORIGIN" "$PUBLIC_APP_URL"
upsert_env "APP_URL" "$PUBLIC_APP_URL"
upsert_env "SELFHOSTED" "true"
upsert_env "AUTH_EMAIL_PASSWORD_SIGNUP" "true"
upsert_env "AUTH_PASSKEY_SIGNUP" "${AUTH_PASSKEY_SIGNUP:-false}"
upsert_env "AUTH_PASSWORDLESS_MODE" "${AUTH_PASSWORDLESS_MODE:-false}"
upsert_env "PRICING_TIERS_ENABLED" "${PRICING_TIERS_ENABLED:-false}"

if [ "${APPWRITE_UNSTABLE:-false}" = "true" ]; then
  upsert_env "APPWRITE_UNSTABLE" "true"
  upsert_env "APPWRITE_IMAGE" "appwrite/appwrite:2.0.0-rc.1"
else
  upsert_env "APPWRITE_UNSTABLE" "false"
  upsert_env "APPWRITE_IMAGE" "${APPWRITE_IMAGE:-appwrite/appwrite:1.9.6}"
fi

if [ -z "${APPWRITE_PROJECT_ID:-}" ] || [ "${KYLRIX_FORCE_LOCAL_PROJECT_ID:-}" = "1" ]; then
  upsert_env "APPWRITE_PROJECT_ID" "kylrix-$(gen_secret 4)"
  upsert_env "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$(grep '^APPWRITE_PROJECT_ID=' "$ENV_FILE" | cut -d= -f2-)"
fi

if [ -z "${APPWRITE_OPENSSL_KEY:-}" ] || [ "${APPWRITE_OPENSSL_KEY}" = "your-secret-key-min-128-bits" ]; then
  upsert_env "APPWRITE_OPENSSL_KEY" "$(gen_secret 32)"
fi

if [ -z "${MARIADB_PASSWORD:-}" ] || [ "${MARIADB_PASSWORD}" = "appwrite-secret-password" ]; then
  upsert_env "MARIADB_PASSWORD" "$(gen_secret 16)"
  upsert_env "MARIADB_USER" "appwrite"
fi

if [ -z "${MARIADB_ROOT_PASSWORD:-}" ] || [ "${MARIADB_ROOT_PASSWORD}" = "appwrite-root-secret" ]; then
  upsert_env "MARIADB_ROOT_PASSWORD" "$(gen_secret 16)"
fi

if [ -z "${KYLRIX_INTERNAL_JOBS_SECRET:-}" ] && [ -z "${INTERNAL_JOBS_SECRET:-}" ]; then
  upsert_env "KYLRIX_INTERNAL_JOBS_SECRET" "$(gen_secret 32)"
fi

if [ -z "${ATTACHMENT_URL_SIGNING_SECRET:-}" ]; then
  upsert_env "ATTACHMENT_URL_SIGNING_SECRET" "$(gen_secret 32)"
fi

if [ -z "${SELFHOST_ADMIN_EMAIL:-}" ] || [ "${SELFHOST_ADMIN_EMAIL}" = "admin@localhost" ]; then
  upsert_env "SELFHOST_ADMIN_EMAIL" "admin@example.com"
fi

if [ -z "${SELFHOST_ADMIN_PASSWORD:-}" ]; then
  upsert_env "SELFHOST_ADMIN_PASSWORD" "$(gen_secret 12)"
fi

echo "Minted self-host .env at ${ENV_FILE}"
