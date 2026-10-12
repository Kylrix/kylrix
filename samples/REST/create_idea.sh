#!/usr/bin/env bash
# Create a new sovereign idea in your Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./create_idea.sh "My Idea Title" "Content details here..." "tag1,tag2"

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"

TITLE="${1:-New Sovereign Idea}"
CONTENT="${2:-Captured via Kylrix REST API.}"
TAGS="${3:-idea,rest}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

PAYLOAD=$(cat <<EOF
{
  "title": "${TITLE}",
  "content": "${CONTENT}",
  "tags": ["$(echo "$TAGS" | sed 's/,/","/g')"]
}
EOF
)

curl -sS -X POST "${KYLRIX_URL%/}/api/v1/ideas" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$PAYLOAD" | (which jq >/dev/null 2>&1 && jq . || cat)
