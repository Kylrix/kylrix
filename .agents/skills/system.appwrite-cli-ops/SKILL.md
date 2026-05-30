---
name: system.appwrite-cli-ops
description: Guide for Appwrite CLI operations, especially table creation and schema management. Always check CLI version first. Use when creating tables, columns, indexes, or managing database schema via CLI instead of manual config editing.
disable-model-invocation: false
---

# Appwrite CLI Operations

## Prerequisites

**Always check the CLI version first:**

```bash
appwrite --version
```

⚠️ **CRITICAL GUARDRAIL (DO NOT BYPASS):**
- **NEVER mutate the Appwrite CLI client config**: DO NOT run commands like `appwrite client --endpoint`, `appwrite client --key`, `appwrite client --project-id`, or `appwrite client --reset`. Doing so will instantly overwrite or delete the user's active login session on their local machine.
- **Respect User Sessions**: Always assume the user is already authenticated in their terminal. If a command fails with "Session not found" or similar auth issues, **do not** try to configure the client or reset it. Stop immediately and politely ask the user to run `appwrite login` on their terminal.

⚠️ **Important:** This skill does **not** have permission to run `appwrite update`. If the version is too old and critical subcommands are missing, notify the user to update manually or consult Appwrite docs for the version you're running.

Supported versions: **17.4.0+** (tables-db, init table, push tables commands available)

## When to Use This Skill

- Creating new tables with columns and indexes via CLI instead of hand-editing `appwrite.config.json`
- Adding columns, indexes, or relationships to existing tables
- Validating schema consistency between live Appwrite and local config
- Running interactive table setup flows
- Pushing schema changes to Appwrite

## Table Operations Workflow

### 1. Create a New Table

Use the interactive or flag-based approach:

**Interactive (recommended for first-time setup):**
```bash
appwrite init table
# Follow prompts for database-id, table-id, name
```

**Direct with flags:**
```bash
appwrite tables-db create-table \
  --database-id <db-id> \
  --table-id <table-id> \
  --name <table-name> \
  --permissions 'create("users")' \
  --row-security true \
  --enabled true
```

### 2. Add Columns

**String column:**
```bash
appwrite tables-db create-string-column \
  --database-id chat \
  --table-id <table-id> \
  --key <column-name> \
  --size 255 \
  --required true \
  --encrypt false
```

**Enum column:**
```bash
appwrite tables-db create-enum-column \
  --database-id chat \
  --table-id <table-id> \
  --key <column-name> \
  --elements value1 value2 value3 \
  --required false \
  --xdefault value1
```

**DateTime column:**
```bash
appwrite tables-db create-datetime-column \
  --database-id chat \
  --table-id <table-id> \
  --key <column-name> \
  --required false
```

**Integer column:**
```bash
appwrite tables-db create-integer-column \
  --database-id chat \
  --table-id <table-id> \
  --key <column-name> \
  --required false \
  --xdefault 0
```

**Boolean column:**
```bash
appwrite tables-db create-boolean-column \
  --database-id chat \
  --table-id <table-id> \
  --key <column-name> \
  --required false
```

### 3. Add Indexes

**Key index (default lookup):**
```bash
appwrite tables-db create-index \
  --database-id chat \
  --table-id <table-id> \
  --key <index-name> \
  --type key \
  --columns col1 col2 \
  --orders ASC DESC
```

**Unique index (enforce uniqueness):**
```bash
appwrite tables-db create-index \
  --database-id chat \
  --table-id <table-id> \
  --key <index-name> \
  --type unique \
  --columns col1 col2 col3 \
  --orders ASC ASC ASC
```

**Fulltext index (search):**
```bash
appwrite tables-db create-index \
  --database-id chat \
  --table-id <table-id> \
  --key <index-name> \
  --type fulltext \
  --columns col1 col2
```

### 4. Verify Schema

**List all columns:**
```bash
appwrite tables-db list-columns \
  --database-id chat \
  --table-id <table-id>
```

**List all indexes:**
```bash
appwrite tables-db list-indexes \
  --database-id chat \
  --table-id <table-id>
```

**Get table details:**
```bash
appwrite tables-db get-table \
  --database-id chat \
  --table-id <table-id>
```

## Common Patterns

### Pattern: Create a Project-like Table

```bash
# 1. Create base table
appwrite tables-db create-table \
  --database-id chat --table-id my_projects \
  --name my_projects --permissions 'create("users")' \
  --row-security true

# 2. Add required fields
appwrite tables-db create-string-column \
  --database-id chat --table-id my_projects \
  --key title --size 255 --required true

appwrite tables-db create-string-column \
  --database-id chat --table-id my_projects \
  --key ownerId --size 64 --required true

# 3. Add optional fields
appwrite tables-db create-string-column \
  --database-id chat --table-id my_projects \
  --key description --size 65535 --required false

appwrite tables-db create-enum-column \
  --database-id chat --table-id my_projects \
  --key status --elements active archived \
  --required false --xdefault active

appwrite tables-db create-datetime-column \
  --database-id chat --table-id my_projects \
  --key createdAt --required false

# 4. Add indexes
appwrite tables-db create-index \
  --database-id chat --table-id my_projects \
  --key idx_owner_created \
  --type key --columns ownerId createdAt \
  --orders ASC DESC
```

## Why CLI Over Config Editing

- **Guaranteed consistency**: CLI validates schema before writing
- **Live feedback**: Column/index status shows as "available" or "processing"
- **No stale config**: Changes sync immediately with Appwrite server
- **Less error-prone**: No manual JSON formatting or trailing commas

## Troubleshooting

**Column creation returns "processing" but verification shows "available":**
This is normal. Appwrite processes columns asynchronously; CLI shows interim status. Wait 10–15 seconds and re-check.

**"Table already exists" error:**
CLI prevents duplicate table IDs in the same database. Use a different `--table-id` or delete the old table first.

**Unique index creation fails:**
Ensure the column combination doesn't already have duplicate values. If the table has data, you may need to clean it first.

**Permission denied on create operations:**
Verify your Appwrite credentials via `appwrite whoami` and ensure your API key has `tables.write` scope.

## CLI Limitations

- **No batch operations**: Columns and indexes are created one at a time
- **No rollback**: If schema creation fails mid-way, you must manually clean up
- **No bulk import**: Cannot load schema from file; use interactive or flag-based workflows

## Static Configuration File Restrictions

⚠️ **CRITICAL ARCHITECTURAL MANDATE:**
- **DO NOT edit `appwrite.config.json` directly**: Manually editing static configuration files is strictly prohibited. It is slow to process, highly error-prone, and can lead to overwriting or breaking live production databases.
- **Strictly use Appwrite CLI live commands**: All schema mutations, including creating tables, columns, and indexes, must be executed directly via live Appwrite CLI commands.
