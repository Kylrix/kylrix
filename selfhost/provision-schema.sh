#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Appwrite Schema Provisioner
# Reads appwrite.config.json and creates all databases, tables, columns,
# indexes, and storage buckets via the Appwrite REST API.
#
# Requirements:
#   - curl, jq
#   - APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in .env or env
#
# Usage:
#   bash selfhost/provision-schema.sh
#   — or —
#   make schema-push
#
# Idempotent: skips resources that already exist (HTTP 409 = already exists).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
skip() { echo -e "  ${DIM}↳ $1 (already exists)${RESET}"; }
fail() { echo -e "  ${RED}✗${RESET} $1" >&2; }
info() { echo -e "  ${CYAN}▸${RESET} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${PROJECT_DIR}/appwrite.config.json"
ENV_FILE="${PROJECT_DIR}/.env"

# ── Load environment ────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-${APPWRITE_ENDPOINT:-${APPWRITE_API:-}}}"
PROJECT="${APPWRITE_PROJECT_ID:-}"
API_KEY="${APPWRITE_API_KEY:-${APPWRITE_API:-}}"

if [ -z "$ENDPOINT" ] || [ -z "$PROJECT" ] || [ -z "$API_KEY" ]; then
    echo ""
    fail "Missing required environment variables:"
    [ -z "$ENDPOINT" ] && echo "     APPWRITE_ENDPOINT"
    [ -z "$PROJECT" ]  && echo "     APPWRITE_PROJECT_ID"
    [ -z "$API_KEY" ]  && echo "     APPWRITE_API_KEY"
    echo ""
    echo "  Set them in .env or export them, then re-run."
    exit 1
fi

# ── Prerequisites ───────────────────────────────────────────────────────────
for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
        fail "'${cmd}' is required but not installed."
        exit 1
    fi
done

if [ ! -f "$CONFIG_FILE" ]; then
    fail "appwrite.config.json not found at ${CONFIG_FILE}"
    exit 1
fi

# ── API Helper ──────────────────────────────────────────────────────────────
# Returns: HTTP status code. Body is in $RESPONSE_BODY.
RESPONSE_BODY=""

api() {
    local method="$1" path="$2"
    shift 2
    local url="${ENDPOINT%/v1}/v1${path}"

    RESPONSE_BODY=$(curl -s -w "\n%{http_code}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -H "X-Appwrite-Project: ${PROJECT}" \
        -H "X-Appwrite-Key: ${API_KEY}" \
        "$@" \
        "$url" 2>/dev/null) || true

    local http_code
    http_code=$(echo "$RESPONSE_BODY" | tail -1)
    RESPONSE_BODY=$(echo "$RESPONSE_BODY" | sed '$d')

    echo "$http_code"
}

# ── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║        🗄️  Kylrix Schema Provisioner             ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
info "Endpoint: ${ENDPOINT}"
info "Project:  ${PROJECT}"
echo ""

# ── Test connection ─────────────────────────────────────────────────────────
info "Testing Appwrite connection..."
HTTP_CODE=$(api GET "/health/version")
if [ "$HTTP_CODE" != "200" ]; then
    fail "Cannot reach Appwrite at ${ENDPOINT} (HTTP ${HTTP_CODE})"
    fail "Response: ${RESPONSE_BODY}"
    exit 1
fi
ok "Appwrite is reachable"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: Databases
# ═════════════════════════════════════════════════════════════════════════════
echo -e "  ${BOLD}── Phase 1: Databases ──${RESET}"
echo ""

DB_COUNT=$(jq '.tablesDB | length' "$CONFIG_FILE")
for i in $(seq 0 $((DB_COUNT - 1))); do
    DB_ID=$(jq -r ".tablesDB[$i].\"\$id\"" "$CONFIG_FILE")
    DB_NAME=$(jq -r ".tablesDB[$i].name" "$CONFIG_FILE")

    HTTP_CODE=$(api POST "/databases" \
        -d "{\"databaseId\":\"${DB_ID}\",\"name\":\"${DB_NAME}\",\"enabled\":true}")

    if [ "$HTTP_CODE" = "201" ]; then
        ok "Database: ${DB_NAME} (${DB_ID})"
    elif [ "$HTTP_CODE" = "409" ]; then
        skip "Database: ${DB_NAME}"
    else
        fail "Database ${DB_NAME}: HTTP ${HTTP_CODE} — ${RESPONSE_BODY}"
    fi
done

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2: Tables (Collections) + Columns (Attributes) + Indexes
# ═════════════════════════════════════════════════════════════════════════════
echo -e "  ${BOLD}── Phase 2: Tables & Columns ──${RESET}"
echo ""

TABLE_COUNT=$(jq '.tables | length' "$CONFIG_FILE")

for i in $(seq 0 $((TABLE_COUNT - 1))); do
    TABLE_ID=$(jq -r ".tables[$i].\"\$id\"" "$CONFIG_FILE")
    TABLE_NAME=$(jq -r ".tables[$i].name" "$CONFIG_FILE")
    TABLE_DB=$(jq -r ".tables[$i].databaseId" "$CONFIG_FILE")
    ROW_SECURITY=$(jq -r ".tables[$i].rowSecurity // true" "$CONFIG_FILE")

    # Create collection/table
    HTTP_CODE=$(api POST "/databases/${TABLE_DB}/collections" \
        -d "{\"collectionId\":\"${TABLE_ID}\",\"name\":\"${TABLE_NAME}\",\"documentSecurity\":${ROW_SECURITY},\"enabled\":true}")

    if [ "$HTTP_CODE" = "201" ]; then
        ok "Table: ${TABLE_DB}/${TABLE_NAME}"
    elif [ "$HTTP_CODE" = "409" ]; then
        skip "Table: ${TABLE_NAME}"
    else
        fail "Table ${TABLE_NAME}: HTTP ${HTTP_CODE}"
    fi

    # ── Create columns (attributes) ──
    COL_COUNT=$(jq ".tables[$i].columns | length" "$CONFIG_FILE")

    for j in $(seq 0 $((COL_COUNT - 1))); do
        COL_KEY=$(jq -r ".tables[$i].columns[$j].key" "$CONFIG_FILE")
        COL_TYPE=$(jq -r ".tables[$i].columns[$j].type" "$CONFIG_FILE")
        COL_REQUIRED=$(jq -r ".tables[$i].columns[$j].required // false" "$CONFIG_FILE")
        COL_ARRAY=$(jq -r ".tables[$i].columns[$j].array // false" "$CONFIG_FILE")
        COL_DEFAULT=$(jq -r ".tables[$i].columns[$j].default // \"null\"" "$CONFIG_FILE")

        # Map type to API endpoint and build payload
        local_endpoint=""
        local_payload=""

        case "$COL_TYPE" in
            string)
                COL_SIZE=$(jq -r ".tables[$i].columns[$j].size // 256" "$CONFIG_FILE")
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/string"
                local_payload="{\"key\":\"${COL_KEY}\",\"size\":${COL_SIZE},\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
            boolean)
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/boolean"
                local_payload="{\"key\":\"${COL_KEY}\",\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
            datetime)
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/datetime"
                local_payload="{\"key\":\"${COL_KEY}\",\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
            integer)
                COL_MIN=$(jq -r ".tables[$i].columns[$j].min // \"null\"" "$CONFIG_FILE")
                COL_MAX=$(jq -r ".tables[$i].columns[$j].max // \"null\"" "$CONFIG_FILE")
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/integer"
                local_payload="{\"key\":\"${COL_KEY}\",\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}"
                [ "$COL_MIN" != "null" ] && local_payload="${local_payload},\"min\":${COL_MIN}"
                [ "$COL_MAX" != "null" ] && local_payload="${local_payload},\"max\":${COL_MAX}"
                local_payload="${local_payload}}"
                ;;
            float|double)
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/float"
                local_payload="{\"key\":\"${COL_KEY}\",\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
            enum)
                COL_ELEMENTS=$(jq -c ".tables[$i].columns[$j].elements // []" "$CONFIG_FILE")
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/enum"
                local_payload="{\"key\":\"${COL_KEY}\",\"elements\":${COL_ELEMENTS},\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
            relationship)
                # Skip relationship attributes — they need special handling
                continue
                ;;
            *)
                # Unknown type — treat as string with large size
                local_endpoint="/databases/${TABLE_DB}/collections/${TABLE_ID}/attributes/string"
                local_payload="{\"key\":\"${COL_KEY}\",\"size\":65535,\"required\":${COL_REQUIRED},\"array\":${COL_ARRAY}}"
                ;;
        esac

        if [ -n "$local_endpoint" ]; then
            HTTP_CODE=$(api POST "$local_endpoint" -d "$local_payload")

            if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "201" ]; then
                : # Attribute created (202 = processing, 201 = done)
            elif [ "$HTTP_CODE" = "409" ]; then
                : # Already exists
            else
                fail "  Column ${TABLE_NAME}.${COL_KEY}: HTTP ${HTTP_CODE}"
            fi
        fi

        # Throttle slightly to avoid Appwrite rate limits during provisioning
        # Only every 5th column to keep it fast
        if [ $((j % 5)) -eq 4 ]; then
            sleep 0.2
        fi
    done

    # ── Create indexes ──
    IDX_COUNT=$(jq ".tables[$i].indexes // [] | length" "$CONFIG_FILE")

    for j in $(seq 0 $((IDX_COUNT - 1))); do
        IDX_KEY=$(jq -r ".tables[$i].indexes[$j].key" "$CONFIG_FILE")
        IDX_TYPE=$(jq -r ".tables[$i].indexes[$j].type // \"key\"" "$CONFIG_FILE")
        IDX_ATTRS=$(jq -c ".tables[$i].indexes[$j].attributes // []" "$CONFIG_FILE")
        IDX_ORDERS=$(jq -c ".tables[$i].indexes[$j].orders // []" "$CONFIG_FILE")

        HTTP_CODE=$(api POST "/databases/${TABLE_DB}/collections/${TABLE_ID}/indexes" \
            -d "{\"key\":\"${IDX_KEY}\",\"type\":\"${IDX_TYPE}\",\"attributes\":${IDX_ATTRS},\"orders\":${IDX_ORDERS}}")

        if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "201" ]; then
            : # Index created
        elif [ "$HTTP_CODE" = "409" ]; then
            : # Already exists
        else
            fail "  Index ${TABLE_NAME}.${IDX_KEY}: HTTP ${HTTP_CODE}"
        fi
    done

    # Brief pause between tables
    sleep 0.3
done

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3: Storage Buckets
# ═════════════════════════════════════════════════════════════════════════════
echo -e "  ${BOLD}── Phase 3: Storage Buckets ──${RESET}"
echo ""

# Buckets are defined in lib/appwrite/config.ts, hardcoded here for portability
BUCKETS=(
    "profile_pictures:Profile Pictures"
    "group_avatars:Group Avatars"
    "notes_attachments:Notes Attachments"
    "event_covers:Event Covers & Blog Media"
    "extension_assets:Extension Assets"
    "backups:Backups"
    "temp_uploads:Temporary Uploads"
    "kylrix_send:Send Ephemeral Files"
    "messages:Chat Messages"
    "vault_attachments:Vault Attachments"
    "form_media:Form Media"
    "form_attachments:Form Attachments"
    "chat_uploads:Chat Uploads"
    "voice:Voice Messages"
)

for bucket in "${BUCKETS[@]}"; do
    BUCKET_ID="${bucket%%:*}"
    BUCKET_NAME="${bucket#*:}"

    HTTP_CODE=$(api POST "/storage/buckets" \
        -d "{\"bucketId\":\"${BUCKET_ID}\",\"name\":\"${BUCKET_NAME}\",\"fileSecurity\":true,\"enabled\":true,\"maximumFileSize\":104857600}")

    if [ "$HTTP_CODE" = "201" ]; then
        ok "Bucket: ${BUCKET_NAME} (${BUCKET_ID})"
    elif [ "$HTTP_CODE" = "409" ]; then
        skip "Bucket: ${BUCKET_NAME}"
    else
        fail "Bucket ${BUCKET_NAME}: HTTP ${HTTP_CODE}"
    fi
done

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║         ✓  Schema Provisioning Complete          ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${DIM}Databases: ${DB_COUNT}${RESET}"
echo -e "  ${DIM}Tables:    ${TABLE_COUNT}${RESET}"
echo -e "  ${DIM}Buckets:   ${#BUCKETS[@]}${RESET}"
echo ""
echo -e "  ${DIM}Note: Appwrite processes attributes asynchronously.${RESET}"
echo -e "  ${DIM}Wait ~30 seconds for all columns to become available.${RESET}"
echo ""
