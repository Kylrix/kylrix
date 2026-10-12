#!/usr/bin/env bash
# Search ideas across your Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./search.sh <keyword>

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"
KEYWORD="${1:-}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

curl -sS -X GET "${KYLRIX_URL%/}/api/v1/ideas?limit=100" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Accept: application/json" | (
    if which jq >/dev/null 2>&1; then
      if [ -n "$KEYWORD" ]; then
        jq --arg q "$KEYWORD" '{query: $q, matches: [.items[]? | select((.title? | test($q; "i")) or (.content? | test($q; "i")))]}'
      else
        jq .
      fi
    else
      cat
    fi
  )
