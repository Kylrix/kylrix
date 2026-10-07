#!/usr/bin/env bash
# List sovereign ideas from Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./list_ideas.sh [limit]

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"
LIMIT="${1:-25}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

curl -sS -X GET "${KYLRIX_URL%/}/api/v1/ideas?limit=${LIMIT}" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Accept: application/json" | (which jq >/dev/null 2>&1 && jq . || cat)
