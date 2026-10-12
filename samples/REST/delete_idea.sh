#!/usr/bin/env bash
# Move an idea to trash in your Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./delete_idea.sh <idea_id>

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: ./delete_idea.sh <idea_id>" >&2
  exit 1
fi

IDEA_ID="$1"

curl -sS -X DELETE "${KYLRIX_URL%/}/api/v1/ideas/${IDEA_ID}" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Accept: application/json" | (which jq >/dev/null 2>&1 && jq . || cat)
