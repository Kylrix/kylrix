#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Mint self-host environment (non-interactive)
# Generates local Appwrite project ID, secrets, and public endpoint URLs.
# Shell exports override planned values (see selfhost/env-overrides.sh).
# Immune: APPWRITE_API_KEY, APPWRITE_PROJECT_ID (when already bootstrapped).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"

# shellcheck source=env-overrides.sh
source "${SCRIPT_DIR}/env-overrides.sh"

gen_secret() {
  openssl rand -hex "${1:-32}" 2>/dev/null || head -c "${1:-32}" /dev/urandom | xxd -p | tr -d '\n'
}

if [ ! -f "$ENV_FILE" ]; then
  cp "${PROJECT_DIR}/env.sample" "$ENV_FILE"
fi

capture_env_override APP_PORT
capture_env_override APPWRITE_PORT
capture_env_override KYLRIX_DOMAIN
capture_env_override KYLRIX_APPWRITE_DOMAIN
capture_env_override KYLRIX_PUBLIC_APP_URL
capture_env_override KYLRIX_PUBLIC_APPWRITE_ENDPOINT
capture_env_override SELFHOST_ADMIN_EMAIL
capture_env_override SELFHOST_ADMIN_PASSWORD
capture_env_override SELFHOST_ADMIN_NAME
capture_env_override BACKEND
capture_env_override KYLRIX_BACKEND
capture_env_override AUTH_EMAIL_PASSWORD_SIGNUP
capture_env_override AUTH_PASSKEY_SIGNUP
capture_env_override AUTH_PASSWORDLESS_MODE
capture_env_override PRICING_TIERS_ENABLED
capture_env_override PRODUCT_NAME
capture_env_override APPWRITE_UNSTABLE
capture_env_override NEXT_PUBLIC_LOGGING_VERBOSE
capture_env_override SMTP_HOST
capture_env_override SMTP_PORT
capture_env_override SMTP_SECURE
capture_env_override SMTP_USERNAME
capture_env_override SMTP_PASSWORD
capture_env_override SYSTEM_EMAIL
capture_env_override SECURITY_EMAIL

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

APP_PORT="$(apply_env_override APP_PORT 5003)"
APPWRITE_PORT="$(apply_env_override APPWRITE_PORT 8080)"
DOMAIN="$(apply_env_override KYLRIX_DOMAIN localhost)"
APPWRITE_DOMAIN="$(apply_env_override KYLRIX_APPWRITE_DOMAIN localhost)"
if has_env_override KYLRIX_PUBLIC_APPWRITE_ENDPOINT; then
  PUBLIC_APPWRITE_ENDPOINT="$(apply_env_override KYLRIX_PUBLIC_APPWRITE_ENDPOINT "")"
else
  PUBLIC_APPWRITE_ENDPOINT="http://localhost:${APPWRITE_PORT}/v1"
fi
PUBLIC_APP_URL="$(apply_env_override KYLRIX_PUBLIC_APP_URL "http://localhost:${APP_PORT}")"

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
upsert_env "APPWRITE_DOMAIN" "$APPWRITE_DOMAIN"
upsert_env "APPWRITE_FUNCTIONS_DOMAIN" "${APPWRITE_FUNCTIONS_DOMAIN:-functions.localhost}"
upsert_env "APPWRITE_ENDPOINT" "http://appwrite/v1"
upsert_env "NEXT_PUBLIC_APPWRITE_ENDPOINT" "$PUBLIC_APPWRITE_ENDPOINT"
upsert_env "NEXT_PUBLIC_APP_URL" "$PUBLIC_APP_URL"
upsert_env "NEXT_PUBLIC_APP_URI" "$PUBLIC_APP_URL"
upsert_env "NEXT_PUBLIC_ORIGIN" "$PUBLIC_APP_URL"
upsert_env "APP_URL" "$PUBLIC_APP_URL"
upsert_env "SELFHOSTED" "true"

BACKEND="$(apply_env_override BACKEND "${KYLRIX_BACKEND:-false}")"
AUTH_EMAIL_PASSWORD_SIGNUP="$(apply_env_override AUTH_EMAIL_PASSWORD_SIGNUP true)"
AUTH_PASSKEY_SIGNUP="$(apply_env_override AUTH_PASSKEY_SIGNUP false)"
AUTH_PASSWORDLESS_MODE="$(apply_env_override AUTH_PASSWORDLESS_MODE false)"
PRICING_TIERS_ENABLED="$(apply_env_override PRICING_TIERS_ENABLED false)"
PRODUCT_NAME="$(apply_env_override PRODUCT_NAME Kylrix)"

upsert_env "BACKEND" "$BACKEND"
upsert_env "AUTH_EMAIL_PASSWORD_SIGNUP" "$AUTH_EMAIL_PASSWORD_SIGNUP"
upsert_env "AUTH_PASSKEY_SIGNUP" "$AUTH_PASSKEY_SIGNUP"
upsert_env "AUTH_PASSWORDLESS_MODE" "$AUTH_PASSWORDLESS_MODE"
upsert_env "PRICING_TIERS_ENABLED" "$PRICING_TIERS_ENABLED"
upsert_env "PRODUCT_NAME" "$PRODUCT_NAME"

if has_env_override NEXT_PUBLIC_LOGGING_VERBOSE; then
  upsert_env "NEXT_PUBLIC_LOGGING_VERBOSE" "$(apply_env_override NEXT_PUBLIC_LOGGING_VERBOSE "")"
fi

APPWRITE_UNSTABLE="$(apply_env_override APPWRITE_UNSTABLE false)"
if [ "$APPWRITE_UNSTABLE" = "true" ]; then
  upsert_env "APPWRITE_UNSTABLE" "true"
  upsert_env "APPWRITE_IMAGE" "appwrite/appwrite:2.0.0-rc.1"
else
  upsert_env "APPWRITE_UNSTABLE" "false"
  upsert_env "APPWRITE_IMAGE" "${APPWRITE_IMAGE:-appwrite/appwrite:1.9.6}"
fi

if [ -z "${APPWRITE_PROJECT_ID:-}" ] || [ "${KYLRIX_FORCE_LOCAL_PROJECT_ID:-}" = "1" ]; then
  upsert_env "APPWRITE_PROJECT_ID" "kylrix-$(gen_secret 4)"
fi

LOCAL_PROJECT_ID="$(grep '^APPWRITE_PROJECT_ID=' "$ENV_FILE" | cut -d= -f2-)"
if [ -n "$LOCAL_PROJECT_ID" ]; then
  upsert_env "NEXT_PUBLIC_APPWRITE_PROJECT_ID" "$LOCAL_PROJECT_ID"
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

ADMIN_EMAIL="$(apply_env_override SELFHOST_ADMIN_EMAIL "")"
if [ -z "$ADMIN_EMAIL" ] || [ "$ADMIN_EMAIL" = "admin@localhost" ]; then
  ADMIN_EMAIL="admin@example.com"
fi
upsert_env "SELFHOST_ADMIN_EMAIL" "$ADMIN_EMAIL"

ADMIN_PASSWORD="$(apply_env_override SELFHOST_ADMIN_PASSWORD "")"
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD="$(gen_secret 12)"
fi
upsert_env "SELFHOST_ADMIN_PASSWORD" "$ADMIN_PASSWORD"

ADMIN_NAME="$(apply_env_override SELFHOST_ADMIN_NAME "Kylrix Admin")"
upsert_env "SELFHOST_ADMIN_NAME" "$ADMIN_NAME"

for smtp_key in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USERNAME SMTP_PASSWORD SYSTEM_EMAIL SECURITY_EMAIL; do
  if has_env_override "$smtp_key"; then
    upsert_env "$smtp_key" "$(apply_env_override "$smtp_key" "")"
  fi
done

echo "Minted self-host .env at ${ENV_FILE}"
