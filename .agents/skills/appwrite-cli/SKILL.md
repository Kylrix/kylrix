---
name: appwrite-cli
description: Appwrite CLI operations, database schema migrations, table/column/index safety, and schema audit procedures.
---

# Appwrite CLI Operations & Schema Guardrails

## 1. IMMUTABLE SAFETY RULES (STRICT)
- **NEVER Hand-Edit \`appwrite.config.json\`**: Manual edits cause silent schema drift and catastrophic production loss.
- **NEVER Run \`appwrite push\`**: Commands like \`appwrite push tables\` or \`appwrite push all\` wipe remote database collections and rows.
- **NEVER Run Ad-Hoc Scripts Against Appwrite**: Do not execute scripts with admin API keys modifying backend databases directly. Use CLI migrations or the HTTP API (\`/api/v1\`).

## 2. Performing Schema Migrations
- Use the official Appwrite CLI:
  - Create table: \`appwrite tablesdb create-table --database-id passwordManagerDb --table-id <id> --name <name>\`
  - Create column: \`appwrite tablesdb create-string-column\`, \`create-integer-column\`, \`create-boolean-column\`, etc.
  - Create index: \`appwrite tablesdb create-index\`
- Use modern data types: Prefer \`varchar\`, \`text\`, \`mediumtext\`, \`longtext\` instead of deprecated generic \`string\`.
- Schema additions are strictly additive-only.
