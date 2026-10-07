#!/usr/bin/env bash
# Update an existing idea in your Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./edit_idea.sh <idea_id> "Updated Title" "Updated Markdown Content"

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: ./edit_idea.sh <idea_id> [new_title] [new_content]" >&2
  exit 1
fi

IDEA_ID="$1"
TITLE="${2:-Updated Idea Title}"
CONTENT="${3:-}"

if [ -n "$CONTENT" ]; then
  PAYLOAD=$(cat <<EOF
{
  "title": "${TITLE}",
  "content": "${CONTENT}"
}
EOF
)
else
  PAYLOAD=$(cat <<EOF
{
  "title": "${TITLE}"
}
EOF
)
fi

curl -sS -X PATCH "${KYLRIX_URL%/}/api/v1/ideas/${IDEA_ID}" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$PAYLOAD" | (which jq >/dev/null 2>&1 && jq . || cat)
