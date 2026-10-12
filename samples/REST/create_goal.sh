#!/usr/bin/env bash
# Create a tracked milestone or goal in your Kylrix workspace.
# Usage:
#   export KYLRIX_TOKEN="kyl_pat_..."
#   ./create_goal.sh "Goal Title" "Goal description" "in_progress"

set -euo pipefail

KYLRIX_URL="${KYLRIX_URL:-https://www.kylrix.space}"
KYLRIX_TOKEN="${KYLRIX_TOKEN:-}"

TITLE="${1:-New Goal}"
DESCRIPTION="${2:-Tracked milestone created via REST API.}"
STATUS="${3:-not_started}"

if [ -z "$KYLRIX_TOKEN" ]; then
  echo "Error: KYLRIX_TOKEN environment variable is required." >&2
  exit 1
fi

PAYLOAD=$(cat <<EOF
{
  "title": "${TITLE}",
  "description": "${DESCRIPTION}",
  "status": "${STATUS}"
}
EOF
)

curl -sS -X POST "${KYLRIX_URL%/}/api/v1/goals" \
  -H "Authorization: Bearer ${KYLRIX_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$PAYLOAD" | (which jq >/dev/null 2>&1 && jq . || cat)
