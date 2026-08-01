---
name: system.appwrite-cli-ops
description: >-
  Kylrix durable Appwrite CLI / schema SoT. Survives official skill reinstalls
  (appwrite-cli, appwrite-typescript). Use for ALL table/column/index work,
  guardrails, deprecated types, pull/push policy, and secure cross-owner writes.
disable-model-invocation: false
---

# Appwrite CLI Operations (Kylrix SoT)

**This skill is repo-owned.** Official `appwrite-cli` / `appwrite-typescript` (via `npx skills add appwrite/agent-skills`) can be overwritten on reinstall. **Every Kylrix Appwrite CLI nuance and guardrail lives here.** Prefer this skill over the official ones when they conflict.

Canonical DB: **`passwordManagerDb`** (single-database mandate). Terminology: **Table** / **Row** — never collection/document.

---

## Prerequisites

```bash
appwrite --version
```

Supported: **17.4.0+** (tables-db). Current ecosystem often **21.x+**.

⚠️ **Do not run `appwrite update`** from the agent — ask the user if the CLI is too old.

### Client / session guardrails (STRICT)

- **NEVER** mutate CLI client config: no `appwrite client --endpoint`, `--key`, `--project-id`, or `--reset`. That wipes the user's local session/prefs.
- Assume the user is already authenticated. On "Session not found" / auth errors: **stop** and ask them to run `appwrite login`. Do not improvise with keys in ways that rewrite prefs.

---

## Ecosystem policy (STRICT — never bypass)

### Config & generated types

- **NEVER** hand-edit `appwrite.config.json` (schema drift / wipe risk).
- **NEVER** hand-edit `generated/` — only `appwrite generate --language typescript` after a successful pull.
- `generated/` is the runtime type SoT; `appwrite.config.json` is sync output only.

### Pull / push

- **NEVER** `appwrite push tables` (destroys/overwrites live schema & data risk).
- **NEVER** `appwrite pull all`.
- **NEVER** `appwrite pull functions` / `appwrite functions pull` (overwrites local function code).
- **Allowed sync path for schema:**
  1. Incremental live CLI: `create-table` / `create-*-column` / `create-index` on the remote.
  2. `appwrite pull tables` → refresh local `appwrite.config.json`.
  3. `appwrite generate --language typescript`.

### Destructive schema (STRICT)

- **NEVER** `update-*-column` / change type, size, required, default, encrypt, or array on an **existing** column.
- **NEVER** `delete-column`, `delete-index`, `delete-column-index`, `delete-table`, or database delete.
- **NEVER** `update-table` to strip permissions, disable `rowSecurity`, rename, or $id-swap live tables.
- **Additive only:** new table ids, new column keys, new index keys.
- Before create: `list-columns` / `list-indexes`; **skip if key exists**.
- New columns on tables with rows: `required false` and/or safe `--xdefault`.
- Prefer a **new table** over reshaping a hot table when the shape change is large.

### Cross-owner / counters

- Install counts, reviews, and any stranger→owner mutation go through **secure-ops + system client** with explicit authz. Never grant strangers write on owner rows.

### Skill reinstall survival

- Put **all** new CLI/schema policy in **this** file (`system.appwrite-cli-ops`), not in `appwrite-cli` / `appwrite-typescript`.
- After `npx skills add appwrite/agent-skills`, re-check that this skill still exists and agents still prefer it for schema work.

---

## Column types — deprecated vs prefer

### Deprecated (do not create)

| Type | Status |
|------|--------|
| **`string`** (`create-string-column`) | **Deprecated.** Legacy only. Existing columns keep working — **do not migrate in place** (see destructive rules). For **new** columns, never use `string`. |

No other column types are marked deprecated in current Appwrite Tables docs. Prefer the explicit text family below.

### Prefer for new text / blob fields

Think about **size + indexing** before creating:

| Prefer | CLI | Max chars | Storage | Indexing | Use when |
|--------|-----|-----------|---------|----------|----------|
| **`varchar`** | `create-varchar-column` | 16,383 | Inline (counts toward **~64KB row** budget) | **Full** index if **size ≤ 768** | IDs, handles, short titles, enum-like codes you filter/sort on |
| **`text`** | `create-text-column` | 16,383 | Off-page (20-byte pointer in row) | Prefix only | Descriptions, short JSON-ish blobs, notes |
| **`mediumtext`** | `create-mediumtext-column` | ~4.2M | Off-page | Prefix only | Large JSON (steps, grants, findings), long bodies |
| **`longtext`** | `create-longtext-column` | ~1B | Off-page | Prefix only | Huge payloads / logs — rare; prefer mediumtext first |

**Caveats (extra thought required):**

1. **`varchar` eats row budget** — many large varchars can blow the 64KB row limit. Keep indexed keys small (≤768 for full indexes).
2. **Off-page types** (`text`+) do not need a `size` the same way; they are weaker for full-value indexes — design queries around keys/`varchar` + payload in mediumtext.
3. **Do not** pick `longtext` by default “to be safe” — prefer the smallest type that fits.
4. **IDs / foreign keys / scope keys:** `varchar` size 64–191, required as appropriate, indexable.
5. **Encrypted secrets:** still use explicit types + `--encrypt` where the product requires it; encryption does not excuse using deprecated `string`.

### Other column types (unchanged preference)

- `create-boolean-column`, `create-integer-column` (counters: min 0 + xdefault 0), `create-float-column`
- `create-datetime-column` (ISO 8601)
- `create-enum-column` (closed vocab: status, tiers)
- `create-email-column`, `create-url-column`, `create-ip-column` when the domain matches
- `create-big-int-column` when values exceed 32-bit integer
- Geometry / relationship only when the product model needs them

---

## Table operations workflow

### 1. Create table

```bash
appwrite tables-db create-table \
  --database-id passwordManagerDb \
  --table-id <table-id> \
  --name <table-name> \
  --permissions 'create("users")' \
  --row-security true \
  --enabled true
```

### 2. Add columns (examples — no deprecated string)

**Short indexed id / title:**

```bash
appwrite tables-db create-varchar-column \
  --database-id passwordManagerDb \
  --table-id <table-id> \
  --key ownerId \
  --size 64 \
  --required false \
  --encrypt false
```

**Description / moderate text:**

```bash
appwrite tables-db create-text-column \
  --database-id passwordManagerDb \
  --table-id <table-id> \
  --key description \
  --required false
```

**Large JSON / findings:**

```bash
appwrite tables-db create-mediumtext-column \
  --database-id passwordManagerDb \
  --table-id <table-id> \
  --key grants \
  --required false
```

**Enum / datetime / integer / boolean:**

```bash
appwrite tables-db create-enum-column \
  --database-id passwordManagerDb --table-id <table-id> \
  --key status --elements active revoked \
  --required false --xdefault active

appwrite tables-db create-datetime-column \
  --database-id passwordManagerDb --table-id <table-id> \
  --key createdAt --required false

appwrite tables-db create-integer-column \
  --database-id passwordManagerDb --table-id <table-id> \
  --key installCount --required false --min 0 --xdefault 0

appwrite tables-db create-boolean-column \
  --database-id passwordManagerDb --table-id <table-id> \
  --key enabled --required false
```

### 3. Indexes

```bash
appwrite tables-db create-index \
  --database-id passwordManagerDb --table-id <table-id> \
  --key idx_<name> --type key \
  --columns col1 col2 --orders ASC DESC

appwrite tables-db create-index \
  --database-id passwordManagerDb --table-id <table-id> \
  --key idx_<name>_uq --type unique \
  --columns col1 col2 col3 --orders ASC ASC ASC
```

Index columns that are queried together. Unique indexes need clean data first.

### 4. Verify → pull → generate

```bash
appwrite tables-db list-columns --database-id passwordManagerDb --table-id <table-id>
appwrite tables-db list-indexes --database-id passwordManagerDb --table-id <table-id>
# wait until status=available
appwrite pull tables
appwrite generate --language typescript
```

---

## Pattern: new table (correct types)

```bash
DB=passwordManagerDb
TID=example_items

appwrite tables-db create-table \
  --database-id "$DB" --table-id "$TID" --name "$TID" \
  --permissions 'create("users")' --row-security true --enabled true

appwrite tables-db create-varchar-column \
  --database-id "$DB" --table-id "$TID" \
  --key ownerId --size 64 --required true --encrypt false

appwrite tables-db create-varchar-column \
  --database-id "$DB" --table-id "$TID" \
  --key title --size 255 --required true --encrypt false

appwrite tables-db create-text-column \
  --database-id "$DB" --table-id "$TID" \
  --key description --required false

appwrite tables-db create-mediumtext-column \
  --database-id "$DB" --table-id "$TID" \
  --key payload --required false

appwrite tables-db create-enum-column \
  --database-id "$DB" --table-id "$TID" \
  --key status --elements active archived \
  --required false --xdefault active

appwrite tables-db create-datetime-column \
  --database-id "$DB" --table-id "$TID" \
  --key createdAt --required false

appwrite tables-db create-index \
  --database-id "$DB" --table-id "$TID" \
  --key idx_owner_created --type key \
  --columns ownerId createdAt --orders ASC DESC
```

---

## Troubleshooting

- **processing → available:** wait 10–15s and re-list.
- **Table already exists:** new `--table-id` only — do not delete.
- **Unique index fails:** dedupe data first; never delete columns to “fix” it without an explicit human disaster plan.
- **Auth / permission denied:** `appwrite whoami`; ask user to login — do not rewrite client config.

## CLI limitations

- No batch create; no automatic rollback mid-flight; clean up only with **additive** follow-ups or human-approved ops (still no delete-column by agent default).

## Related

- Official CLI reference (overwritable): `appwrite-cli`
- Official TS patterns (overwritable): `appwrite-typescript`
- Flow install/review punches: `flow.schema-install-review`
- Single DB / Table-Row terms: root `AGENTS.md`
