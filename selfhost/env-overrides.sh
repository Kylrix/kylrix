#!/usr/bin/env bash
# Capture shell exports before .env is loaded (one-liner / curl | bash config).
# Immune keys (bootstrap-minted, never taken from stale shell): APPWRITE_API_KEY,
# APPWRITE_API, APPWRITE_PROJECT_ID (unless KYLRIX_FORCE_LOCAL_PROJECT_ID).
set -euo pipefail

capture_env_override() {
  local key="$1"
  # Indirect expansion: value of variable named $key in caller's environment
  local val="${!key:-}"
  if [ -n "$val" ]; then
    printf -v "KYLRIX_OVERRIDE_${key}" '%s' "$val"
    export "KYLRIX_OVERRIDE_${key}"
  fi
}

# Ports & public URLs
capture_env_override APP_PORT
capture_env_override APPWRITE_PORT
capture_env_override KYLRIX_DOMAIN
capture_env_override KYLRIX_APPWRITE_DOMAIN
capture_env_override KYLRIX_PUBLIC_APP_URL
capture_env_override KYLRIX_PUBLIC_APPWRITE_ENDPOINT

# Bootstrap admin (true one-click login)
capture_env_override SELFHOST_ADMIN_EMAIL
capture_env_override SELFHOST_ADMIN_PASSWORD
capture_env_override SELFHOST_ADMIN_NAME

# Auth & product surface
capture_env_override AUTH_EMAIL_PASSWORD_SIGNUP
capture_env_override AUTH_PASSKEY_SIGNUP
capture_env_override AUTH_PASSWORDLESS_MODE
capture_env_override PRICING_TIERS_ENABLED
capture_env_override PRODUCT_NAME
capture_env_override APPWRITE_UNSTABLE
capture_env_override NEXT_PUBLIC_LOGGING_VERBOSE

# Optional SMTP (local mail)
capture_env_override SMTP_HOST
capture_env_override SMTP_PORT
capture_env_override SMTP_SECURE
capture_env_override SMTP_USERNAME
capture_env_override SMTP_PASSWORD
capture_env_override SYSTEM_EMAIL
capture_env_override SECURITY_EMAIL

apply_env_override() {
  local key="$1"
  local fallback="${2:-}"
  local override_var="KYLRIX_OVERRIDE_${key}"
  local override_val="${!override_var:-}"
  if [ -n "$override_val" ]; then
    printf '%s' "$override_val"
  elif [ -n "${!key:-}" ]; then
    printf '%s' "${!key}"
  else
    printf '%s' "$fallback"
  fi
}

has_env_override() {
  local key="$1"
  local override_var="KYLRIX_OVERRIDE_${key}"
  [ -n "${!override_var:-}" ]
}
