#!/usr/bin/env bash
# Inspect current authenticated actor identity and permissions.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./whoami.sh

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  echo "Example: export KYLRIX_TOKEN='kyl_pat_...'" >&2
  exit 1
fi

curl -sS -X GET "${KYLRIX_URL%/}/api/v1/me" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Accept: application/json" | (which jq >/dev/null 2>&1 && jq . || cat)
