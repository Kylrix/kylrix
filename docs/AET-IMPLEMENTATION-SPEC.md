# Agent Enclave Token (AET) — Implementation Specification

| Field | Value |
|---|---|
| Status | Ready for implementation |
| Scope | GitHub issues #300–#319 (follow-ups to PR #299) |
| Owner (design) | Security architecture |
| Implementer | SWE-2 agent |
| Base commit | `204b473f` (merge of PR #299) |
| Primary surfaces | `lib/security`, `lib/services/pats.ts`, `lib/api`, `components/settings/CreatePatDrawer.tsx`, `packages/cli`, `packages/vscode` |

---

## 0. How to Use This Spec

1. Read sections 1–3 once. They define the token format, the key hierarchy, and the data structures that every phase depends on.
2. Implement phases in the **execution order** given in §3.1. The order is not 1→6. Phase 4 lands right after Phase 1 because Phase 2 depends on its crypto API.
3. Each issue in §4 has: problem, files, solution, tests, and acceptance criteria. An issue is done only when all its acceptance criteria hold.
4. Follow repository rules from `AGENTS.md` throughout (summarized in §13). Rules that matter most here:
   - `pnpm` only. Use "Table"/"Row", never "Collection"/"Document". All schema truth lives in `turso-schema.sql`.
   - Do not add new Appwrite-shaped code paths (`APPWRITE_CONFIG`, `tables.getRow`, `Query.*`). New data access uses Drizzle (`@/lib/db`, `@/lib/db/schema`) directly. Existing shim-based handlers may be *extended*, but do not grow the shim itself.
   - UI copy must be plain language. Do not show "zero-knowledge", "DEK", "etkSecret", "E2EE", or "entropy" to users (see §8.4).
   - Overlays are conditionally rendered and use `keepMounted: false` and `disablePortal: true`.
   - Any change to `packages/cli` requires a patch version bump in **both** `packages/cli/package.json` and `packages/cli/src/updater/index.ts` (currently `1.0.20`), a rebuild with `pnpm --filter @kylrix/cli build`, and passing tests. Never run `npm publish`/`pnpm publish`; the human owner does that.
   - Record hard-won quirks in `.agents/skills/security/SKILL.md` (see §12.4).

---

## 1. Executive Summary

### 1.1 What an AET is

An **Agent Enclave Token (AET)** lets a human hand an AI agent (Claude Code, Cursor, a CI job, a script) **read access to a chosen subset of encrypted vault rows** without giving the agent the Master Encryption Key (MEK) and without the server ever being able to decrypt those rows on its own.

It does this with two secrets packed into one string:

- an **auth part** (a normal server-verifiable access token, stored as a SHA-256 hash), and
- an **unlock part** (`etkSecret`, 256 random bits) that **only the client ever generates or holds**. The browser uses it to re-wrap the per-row Data Encryption Keys (DEKs) of the rows the user chose. The server stores only those re-wrapped DEKs.

### 1.2 Current state (after PR #299)

PR #299 shipped primitives and UI scaffolding, but the end-to-end feature does not work:

| Area | State | Issues |
|---|---|---|
| Token format | `kyl_apk_` reused; collides with Agent Provisioning Keys | #300 |
| Crypto module | Works for happy paths; strings used for secrets; no input validation; SHA-256 "KDF"; no-op string zeroing | #305, #309, #310, #311, #313, #314 |
| Web UI | Wizard collects choices, then mints an ordinary PAT; header blank on wizard steps; choices lost on close; resource toggles not mapped to scopes | #301, #306, #316, #317 |
| CLI | `connectAgentCommand` is unregistered and a stub; `exec --token` absent | #302, #303, #308, #318 |
| API | `X-Kylrix-Agent-Token` documented, not implemented | #307 |
| VS Code | Secret typed into terminal (scrollback/history); no input validation | #304, #315 |
| Docs | Describe all of the above as shipped | #319 |

Because no code path ever minted an AET, **no AET exists in production**. This makes the format change in #300 a clean break with no live-token migration (see §11).

### 1.3 Goals

1. A distinct, unambiguous token format: `kyl_aet_<prefix>_<authSecret>.etk_<hex>`.
2. A real mint flow in the browser that wraps permitted row DEKs client-side.
3. Two ways to use an AET:
   - **Client-side unlock (default, true zero-knowledge):** CLI (`kylrix agents connect`, `kylrix exec`) and VS Code. The server never sees `etkSecret`.
   - **Server-assisted unlock (opt-in):** `X-Kylrix-Agent-Token` header for clients that cannot run crypto (curl, webhooks). The server sees `etkSecret` only for the duration of one request. This trade-off is stated plainly in the docs.
4. Secrets held as `Uint8Array` and zeroed after use. Docs state honestly where this is impossible (JS strings, child-process env).
5. Docs that match shipped behavior.

### 1.4 Non-goals (explicitly out of scope)

- Changing Agent Provisioning Keys (`kyl_apk_`). They keep their current format and meaning.
- Write access through an AET. AETs unlock **reads** of encrypted fields only. Writes still require an unlocked vault (MEK).
- Automatically adding rows created *after* minting to an AET. This needs a future "refresh access" flow (§10.4).
- MCP stdio server (`packages/cli/src/mcp/stdio.ts`) decryption support. It is a recommended follow-up, not part of #300–#319.
- Schema changes to `turso-schema.sql`. Everything here fits in existing columns (`apikey.category`, `apikey.metadata`, row `dek` / `metadata`).

---

## 2. Architecture Overview

### 2.1 Key hierarchy

```
Master Password / Passkey PRF
        │  Argon2id (primary) / PBKDF2-600k (legacy)   [lib/masterpass-crypto.ts]
        ▼
       MEK  (256-bit, lives only in the unlocked client)
        │  AES-256-GCM wrap, 16-byte IV                 [existing row format]
        ▼
   Row DEK (256-bit, one per Row)  ◄────────────────┐
        │  AES-256-GCM, 16-byte IV                   │ re-wrapped at mint time
        ▼                                            │
   Encrypted Row fields                              │
                                                     │
etkSecret (256-bit random, client-only)              │
        │  HKDF-SHA256(salt = envelope.salt,         │
        │              info = "kylrix/aet/dek-wrap/v1")
        ▼                                            │
   AET wrapping key ── AES-256-GCM, 12-byte IV, ─────┘
                       AAD = resourceKey ("credential:<id>")
```

Notes:

- The MEK-wrapped DEK format already in use is defined in `lib/api/vault-crypto.ts:87-117` and `:122-169`: `wrappedDek = base64( IV(16) || AES-GCM(MEK, utf8( base64(rawDek) )) )`. The inner plaintext is the **base64 text** of the DEK, not raw bytes. New helpers in §2.5 must reproduce this exactly.
- Encrypted fields use `base64( IV(16) || AES-GCM(DEK, utf8(value)) )` (`encryptFieldWithKey`, `vault-crypto.ts:87-99`).
- The AET wrap uses a fresh 12-byte IV per entry and binds each entry to its `resourceKey` as AAD. Without AAD, anyone who can write `apikey.metadata` (such as a compromised server) could swap entries between rows so the agent decrypts row A's data while it believes it is reading row B.

### 2.2 Token format

```
kyl_aet_<prefix>_<authSecret>.etk_<etkHex>
└──────── bearer (auth part) ────────┘ └── unlock part ──┘
```

| Segment | Format | Source | Sent to server? |
|---|---|---|---|
| `kyl_aet_` | literal | — | yes |
| `<prefix>` | exactly 8 lowercase hex chars (`randomBytes(4).toString('hex')`) | server | yes (lookup key, stored in `apikey.prefix`/`start`) |
| `_` | literal | — | yes |
| `<authSecret>` | exactly 32 base64url chars (`randomBytes(24).toString('base64url')`, the existing `makeSecret()`) | server | yes (hashed) |
| `.` | literal separator; cannot appear in base64url or hex | — | **no** |
| `etk_<etkHex>` | `etk_` + exactly 64 lowercase hex chars (32 bytes) | client | **never in client-side mode**; only in `X-Kylrix-Agent-Token` mode |

Canonical regex:

```ts
export const AET_REGEX =
  /^kyl_aet_([0-9a-f]{8})_([A-Za-z0-9_-]{32})\.etk_([0-9a-f]{64})$/;
export const AET_BEARER_REGEX = /^kyl_aet_([0-9a-f]{8})_([A-Za-z0-9_-]{32})$/;
```

Design decisions:

- **Hex prefix, fixed length.** The existing PAT prefix (`randomBytes(6).toString('base64url').slice(0, 8)`, `lib/services/pats.ts:198`) can contain `_` or `-`, which makes `parsePatToken`'s `indexOf('_')` split ambiguous. A fixed-length hex prefix avoids that for AETs. (Do not change the prefix of other PAT categories; that is out of scope.)
- **`apikey.key` stores `sha256(bearer)`**, never anything that includes the unlock part. `PatService.create` already hashes exactly the string it formats, so this holds by construction as long as the server formats only the bearer.
- **Why not reuse the PAT id as `tokenId`?** The PR #299 sketch used `kyl_apk_<tokenId>.<etkSecret>`, where the left half was not a verifiable credential. An agent would have had no way to authenticate. The new left half *is* a full credential.

### 2.3 Data structures

All types live in `lib/security/zero-knowledge.ts` unless stated otherwise.

```ts
export type AetResourceKind = 'credential' | 'totp' | 'note';
/** `${kind}:${rowId}` — also used as AES-GCM AAD. */
export type AetResourceKey = `${AetResourceKind}:${string}`;

export interface WrappedDekEntry {
  wrappedDek: string;        // base64, decodes to exactly 48 bytes (32 DEK + 16 GCM tag)
  iv: string;                // base64, decodes to exactly 12 bytes
  algorithm: 'AES-256-GCM';  // validated on read (#311)
}

export interface WrappedDekMap {
  [resourceKey: AetResourceKey]: WrappedDekEntry;
}

/** Stored at apikey.metadata.aet (JSON). Never returned by list endpoints. */
export interface AetEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  salt: string;              // base64, 16 random bytes
  resources: { credential: boolean; totp: boolean; note: boolean };
  createdAt: string;         // ISO-8601
  deks: WrappedDekMap;       // max 500 entries
}

export interface ParsedAgentToken {
  prefix: string;            // 8 hex chars
  bearer: string;            // 'kyl_aet_<prefix>_<authSecret>' — the only part for Authorization
  etkSecret: Uint8Array;     // 32 bytes; caller MUST zeroClearBytes() when done
}

export interface EncryptedPayload {
  encryptedData: string;     // base64 ciphertext+tag
  iv: string;                // base64, 12 bytes
  isEncrypted: true;
  algorithm: 'AES-256-GCM';
}

export type ZeroKnowledgeErrorCode =
  | 'invalid_token'
  | 'legacy_token_format'
  | 'invalid_encoding'
  | 'invalid_key_length'
  | 'unsupported_algorithm'
  | 'invalid_envelope'
  | 'decrypt_failed';

export class ZeroKnowledgeError extends Error {
  constructor(public readonly code: ZeroKnowledgeErrorCode, message: string) {
    super(message);
    this.name = 'ZeroKnowledgeError';
  }
}
```

`apikey.metadata` (existing TEXT column, `turso-schema.sql:121`) becomes:

```json
{
  "agentId": null,
  "aet": {
    "v": 1,
    "alg": "AES-256-GCM",
    "kdf": "HKDF-SHA256",
    "salt": "q8m2...==",
    "resources": { "credential": true, "totp": true, "note": false },
    "createdAt": "2026-10-28T12:00:00.000Z",
    "deks": {
      "credential:cred_8f2a": { "wrappedDek": "…", "iv": "…", "algorithm": "AES-256-GCM" }
    }
  }
}
```

New PAT category: add `'agent_enclave_token'` to `PatCategory` (`lib/services/pats.ts:7`). `apikey.category` is free TEXT (`turso-schema.sql:122`), so no migration is needed.

### 2.4 Flows

#### 2.4.1 Mint (browser, vault unlocked)

```
Browser (MEK in memory)                                Server (Next.js + Turso)
───────────────────────                                ────────────────────────
1. etk  = getRandomValues(32)
   salt = getRandomValues(16)
   wrapKey = HKDF(etk, salt, "kylrix/aet/dek-wrap/v1")
2. rows = permitted Rows that carry a wrapped DEK
   for each row:
     dek   = unwrapRowDek(row wrapped DEK, MEK)   // 32 bytes
     entry = AES-GCM(wrapKey, dek, iv=rand12, aad=resourceKey)
     zeroClearBytes(dek)
3. createPat({ name, scopes, expiresAt,
               keyCategory: 'agent_enclave_token',
               aetEnvelope })  ───────────────────────►  validateAetEnvelope()   (shape only)
                                                          prefix = hex(4 bytes)
                                                          bearer = kyl_aet_<prefix>_<secret>
                                                          apikey.key = sha256(bearer)
                                                          apikey.metadata.aet = envelope
                                 ◄──────────────────────  { pat, token: bearer }
4. aet = bearer + '.etk_' + hex(etk)
   show once, copy, zeroClearBytes(etk)
```

#### 2.4.2 Use: client-side unlock (CLI, VS Code-launched terminals)

```
Agent / kylrix CLI                                     Server
──────────────────                                     ──────
parseAgentToken(KYLRIX_AGENT_KEY) → { bearer, etk }
GET /api/v1/token/enclave      Authorization: Bearer <bearer>  ──►  verifyBearer, require category
                                                    ◄──  { envelope, scopes, expiresAt }
GET /api/v1/vault/items?sealed=1   Authorization: Bearer <bearer>  ──►  ciphertext fields only
                                                    ◄──  [{ id, name, sealed: {...} }]
for each row in envelope:
  dek = unwrapDekFromMap(envelope, 'credential:<id>', etk)
  fields = decryptRowField(sealed.*, dek); zeroClearBytes(dek)
spawn child with env; on exit zero buffers, drop references
```

The server never receives `etkSecret` and cannot decrypt.

#### 2.4.3 Use: server-assisted unlock (`X-Kylrix-Agent-Token`)

```
curl -H "X-Kylrix-Agent-Token: <full AET>"  ──►  resolveApiActor:
                                                    parseAgentToken → bearer, etk
                                                    verifyBearer(bearer); category check
                                                    attachEnclave(actor, { etk, envelope })   // WeakMap
                                                  handler (vault/totp):
                                                    for rows in envelope: unwrap → decrypt
                                                  withApiGuard finally:
                                                    releaseEnclave(actor)  // zero etk + DEKs
                                    ◄──  plaintext fields, Cache-Control: no-store
```

The server sees `etkSecret` for one request. It never logs it, persists it, caches it, or reads it from a query string.

### 2.5 Row-format compatibility helpers

Add these browser-safe and Node-safe helpers to `lib/security/zero-knowledge.ts`. They must not use `Buffer` unconditionally; route all base64 work through the module's `base64ToBytes`/`bytesToBase64`.

```ts
/** Reads the MEK-wrapped DEK carried by a Row. */
export function getRowWrappedDek(row: Record<string, unknown>): string | null {
  if (typeof row.dek === 'string' && row.dek.trim()) return row.dek.trim();
  const meta = safeJson(row.metadata);
  return typeof meta?.dek === 'string' && meta.dek.trim() ? meta.dek.trim() : null;
}

/** Unwraps a Row DEK produced by lib/api/vault-crypto.ts (16-byte IV, base64-text plaintext). */
export async function unwrapRowDek(wrappedDekB64: string, mek: CryptoKey): Promise<Uint8Array>;

/** Decrypts one Row field produced by encryptFieldWithKey (16-byte IV prefix). */
export async function decryptRowField(fieldB64: string, dek: Uint8Array): Promise<string>;
```

> **Precondition to verify before Phase 2 (schema drift):** `lib/api/resources.ts` reads Rows from a `credentials` Table through the legacy shim and expects `row.dek`. `turso-schema.sql` defines `vault_items` (`:901`) and `totp_secrets` (`:819`) **without** a `dek` column, while `notes` (`:420`) has one. `getRowWrappedDek` covers both `row.dek` and `metadata.dek`. SWE-2 must confirm which physical Table and column actually holds credential/TOTP wrapped DEKs in the running database, and record the answer in `.agents/skills/security/SKILL.md`. Rows with no wrapped DEK (legacy MEK-direct encryption, `docs/security-and-vault.md` "Tier 2") **cannot be shared through an AET**. The mint flow skips them and tells the user how many were skipped.

---

## 3. Implementation Plan

### 3.1 Phases and execution order

| Phase | Issues | Theme | Depends on |
|---|---|---|---|
| 1 | #300, #304, #305 | Critical security fixes (token format, terminal leak, honest zeroing) | — |
| 4 | #309, #310, #311, #313, #314 | Harden crypto module | 1 |
| 2 | #301, #302, #303 (+ #317, required by #301) | Core AET: mint in UI, `agents connect` | 1, 4 |
| 3 | #307, #308 | API header + `exec` integration | 2 |
| 5 | #306, #312, #315, #316, #318 | UX polish + test coverage | 2 |
| 6 | #319 | Documentation | 1–5 |

**Execute in the order 1 → 4 → 2 → 3 → 5 → 6.** Phase numbers stay as originally assigned so issue cross-references do not break. #317 (scope mapping) is listed under Phase 5 in the original plan, but #301 cannot be correct without it, so it ships with Phase 2.

### 3.2 Commit and push cadence

- One commit per phase, with a message such as `fix(aet): distinct kyl_aet_ token format and honest secret zeroing (#300 #304 #305)`. Reference the issue numbers so GitHub links them. Use `Fixes #NNN` only in the commit that fully satisfies the acceptance criteria.
- No `Co-authored-by` trailers (repo rule).
- A phase that touches `packages/cli` bumps the CLI patch version once in that commit (`1.0.20 → 1.0.21`, then `1.0.22`, …) in **both** version files, rebuilds `dist/`, and runs CLI tests.
- Push to `origin` after each phase. Sync the fork only after `pnpm lint` and type-check pass, and only when the user has asked for those checks (see `AGENTS.md`).

### 3.3 Definition of done (whole project)

- All acceptance criteria in §4 pass.
- `pnpm vitest run lib/security lib/services/pats.test.ts components/settings/CreatePatDrawer.test.ts packages/cli` passes.
- The manual E2E checklist in §10.3 passes against a server the **user** starts on `localhost:3005`. Do not start dev servers as the agent.
- The security checklist in §11 is fully ticked.
- `grep -rn "kyl_apk_" --include=*.ts --include=*.tsx --include=*.md . | grep -v node_modules | grep -v dist` shows only Agent Provisioning Key usages (see §11.2).

---

## 4. Detailed Issue Specifications

### Phase 1 — Critical security fixes

#### #300 — Token format collision (`kyl_apk_`)

**Problem.** `formatPatToken` (`lib/services/pats.ts:52-70`) emits `kyl_apk_<prefix>_<secret>` for Agent Provisioning Keys. `ZeroKnowledgeModule.formatAgentToken` (`lib/security/zero-knowledge.ts:115-118`) emits `kyl_apk_<tokenId>.<etkSecret>`. Prefix checks in `lib/api/guard.ts:64-71` and `packages/cli/src/commands/auth.ts:45,236` cannot tell them apart.

**Files.**

| File | Lines | Change |
|---|---|---|
| `lib/security/zero-knowledge.ts` | 24-28, 100-139 | New `ParsedAgentToken`, `AET_REGEX`, `parseAgentToken`, `formatAgentToken`, `generateEtkSecret`, `isAgentEnclaveToken`, `splitAgentToken`, `validateAgentTokenInput` |
| `lib/services/pats.ts` | 7, 52-104, 174-201 | `agent_enclave_token` category; `kyl_aet_` format/parse; hex prefix for AET |
| `lib/api/guard.ts` | 64-71, 86-99 | Accept `kyl_aet_` bearer; strip unlock part defensively; set `isAgent` |
| `packages/cli/src/commands/auth.ts` | 42-52, 236 | Detect AET; never persist unlock part to config |
| `packages/cli/src/client.ts` | token → Authorization | Send bearer part only |
| `packages/cli/src/config.ts` | `resolveEnvironment` | Read `KYLRIX_AGENT_KEY`; split AET |

**Solution.**

`lib/security/zero-knowledge.ts`:

```ts
export const AET_PREFIX = 'kyl_aet_';

export function isAgentEnclaveToken(value: unknown): value is string {
  return typeof value === 'string' && AET_REGEX.test(value.trim());
}

/** Returns the bearer part of an AET, or the input unchanged if it is not an AET. */
export function toBearerCredential(value: string): string {
  const t = value.trim();
  if (t.startsWith(AET_PREFIX) && t.includes('.')) return t.slice(0, t.indexOf('.'));
  return t;
}

export function parseAgentToken(input: unknown): ParsedAgentToken {
  if (typeof input !== 'string') throw new ZeroKnowledgeError('invalid_token', 'Agent key must be text');
  const t = input.trim();
  if (t.startsWith('kyl_apk_') && t.includes('.')) {
    throw new ZeroKnowledgeError('legacy_token_format',
      'This agent key uses an old preview format. Create a new agent key in Settings.');
  }
  const m = AET_REGEX.exec(t);
  if (!m) throw new ZeroKnowledgeError('invalid_token', 'Not a valid agent key');
  const [, prefix, authSecret, etkHex] = m;
  return { prefix, bearer: `kyl_aet_${prefix}_${authSecret}`, etkSecret: hexToBytes(etkHex) };
}

export function formatAgentToken(bearer: string, etkSecret: Uint8Array): string {
  if (!AET_BEARER_REGEX.test(bearer)) throw new ZeroKnowledgeError('invalid_token', 'Invalid bearer part');
  if (etkSecret.byteLength !== 32) throw new ZeroKnowledgeError('invalid_key_length', 'Unlock key must be 32 bytes');
  return `${bearer}.etk_${bytesToHex(etkSecret)}`;
}

export function generateEtkSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** For input boxes: returns a plain-language error, or null when valid. Never echoes the value. */
export function validateAgentTokenInput(value: string): string | null {
  if (!value?.trim()) return 'Paste your agent key';
  try { const p = parseAgentToken(value); zeroClearBytes(p.etkSecret); return null; }
  catch (e) {
    if (e instanceof ZeroKnowledgeError && e.code === 'legacy_token_format') return e.message;
    return 'This does not look like an agent key. It should start with kyl_aet_';
  }
}
```

`parseAgentToken` **throws** instead of returning `null`. Callers need to tell "not an AET" from "old preview format", and a throw cannot be silently ignored the way a null can. Callers that just want a yes/no answer use `isAgentEnclaveToken`.

`lib/services/pats.ts`:

```ts
export type PatCategory =
  | 'user_pat' | 'agent_provisioning_key' | 'agentic_pat'
  | 'workspace_pat' | 'punch_token' | 'agent_enclave_token';

// formatPatToken
if (category === 'agent_enclave_token') return `kyl_aet_${prefix}_${secret}`;

// parsePatToken — add BEFORE the kyl_apk_ branch; strip the unlock part first
const token = toBearerCredential(String(raw || ''));
if (token.startsWith('kyl_aet_')) {
  if (!AET_BEARER_REGEX.test(token)) return null;
  return { prefix: token.slice(8, 16), token, category: 'agent_enclave_token' };
}

// create(): AET prefix must be hex, fixed length
const tokenPrefix = category === 'agent_enclave_token'
  ? randomBytes(4).toString('hex')
  : randomBytes(6).toString('base64url').slice(0, 8);
```

`parsePatToken` returns `token` = bearer only, so `hashToken(parsed.token)` in `verifyBearer` (`:394`) matches `apikey.key` even if a client mistakenly sends the full AET.

`lib/api/guard.ts`: add `bearer.startsWith('kyl_aet_')` to the list at `:64-71`. Compute `isAgent` as true for `agent_enclave_token`. Never put the raw bearer or any header value into an error message.

`packages/cli/src/commands/auth.ts`:

- `:45` add an `else if (effectiveToken.startsWith('kyl_aet_'))` branch *before* the `kyl_apk_` branch: `contextLevel = 'Agent Enclave Token (read-only access to chosen items)'`.
- Before `saveConfig` (`:66`), set `token: toBearerCredential(effectiveToken)`. If the unlock part was dropped, print: `Saved sign-in only. The unlock part of your agent key is never written to disk. Set KYLRIX_AGENT_KEY to unlock items.`
- `:236` (`whoami`), add the `kyl_aet_` label.

`packages/cli/src/client.ts`: wherever the `Authorization: Bearer` header is built, pass `toBearerCredential(token)`. This is the single choke point that keeps the unlock part off the wire in client-side mode.

`packages/cli/src/config.ts` → `resolveEnvironment`: if no explicit token is set and `process.env.KYLRIX_AGENT_KEY` is an AET, use `toBearerCredential(KYLRIX_AGENT_KEY)` as the token. Existing `kyl_apk_` handling of `KYLRIX_AGENT_KEY` stays unchanged.

**Tests.**

- `lib/services/pats.test.ts`: `formatPatToken(p, s, 'agent_enclave_token')` → `kyl_aet_…`. `parsePatToken` on a bearer, on a full AET (returns bearer as `token`), and on a malformed AET (→ `null`). The existing `kyl_apk_apkprefix_secret12345` test (`:16`) still passes unchanged.
- `lib/security/zero-knowledge.test.ts`: format→parse round trip; `kyl_apk_x.etk_…` → `legacy_token_format`; `kyl_apk_abcd1234_secret…` (no dot) → `invalid_token`; `toBearerCredential` on AET, PAT, and garbage input.
- CLI unit test: `toBearerCredential` is applied in the client header builder (mock fetch and assert the header never contains `.etk_`).

**Acceptance criteria.**

- [ ] No code path emits `kyl_apk_<x>.<y>`.
- [ ] `kyl_apk_` tokens keep authenticating as `agent_provisioning_key` with zero behavior change.
- [ ] A `kyl_aet_` bearer authenticates as category `agent_enclave_token`. A full AET in `Authorization` also authenticates, but the unlock part is discarded before any hashing, caching, or logging.
- [ ] `~/.kylrix` config never contains `.etk_` after `kylrix login --token <AET>`.
- [ ] The CLI never sends `.etk_` in `Authorization`.

---

#### #304 — VS Code `injectTerminalSecrets` leaks to scrollback

**Problem.** `packages/vscode/src/extension.ts:129-140` calls `terminal.sendText('export KYLRIX_AGENT_KEY="…"')`. That writes the secret to scrollback and shell history. (Option 3 in the issue, `sendText(text, false)`, does **not** help: the second argument only controls the trailing newline. Do not use it.)

**Files.** `packages/vscode/src/extension.ts:129-140`.

**Solution.**

```ts
vscode.commands.registerCommand('kylrix.injectTerminalSecrets', async () => {
  const token = await vscode.window.showInputBox({
    prompt: 'Paste your Kylrix agent key',
    placeHolder: 'kyl_aet_…',
    password: true,
    ignoreFocusOut: true,
    validateInput: validateAgentTokenInput,
  });
  if (!token) return;
  const terminal = vscode.window.createTerminal({
    name: 'Kylrix Agent',
    env: { KYLRIX_AGENT_KEY: token.trim() },
    isTransient: true,          // not restored on window reload
  });
  terminal.show();
  vscode.window.showInformationMessage(
    'Opened a new Kylrix terminal with your agent key loaded. The key is not shown in the terminal.'
  );
}),
```

Rules:

- Always create a **new** terminal. Env cannot be added to an existing terminal without typing into it.
- Do **not** use `context.environmentVariableCollection`. It is persisted to workspace storage on disk.
- Do **not** write temp files (issue option 2). A crash between write and delete leaves the secret on disk.
- Import `validateAgentTokenInput` from `@/lib/security/zero-knowledge`. The extension already imports from `@/packages/cli/src/*`, so the `@/` alias resolves.
- Never `console.log` the token.

**Tests.** Add to `packages/vscode/src/extension.test.ts` (vitest, mocked `vscode`): the command calls `createTerminal` with `env.KYLRIX_AGENT_KEY` and `isTransient: true`, and **never** calls `sendText`.

**Acceptance criteria.**

- [ ] `sendText` is not called anywhere in the inject flow.
- [ ] The input box masks the value (`password: true`) and rejects malformed keys.
- [ ] In the new terminal, `echo ${KYLRIX_AGENT_KEY:0:8}` prints `kyl_aet_`, and `history` shows no key.

---

#### #305 — `zeroClearStrings` is a no-op

**Problem.** `lib/security/zero-knowledge.ts:81-85` reassigns array slots. JS strings are immutable, so nothing is wiped. The test at `zero-knowledge.test.ts:72-80` checks only the array.

**Files.** `lib/security/zero-knowledge.ts:78-85, 273-278`; `lib/security/zero-knowledge.test.ts:2, 72-80`.

**Solution.**

1. **Delete** `zeroClearStrings` and its export from `ZeroKnowledgeModule`. Before deleting, run `grep -rn zeroClearStrings --exclude-dir=node_modules --exclude-dir=dist .`. Today the only callers are the module and its test.
2. Keep `zeroClearBytes`. Add a scoped helper so callers cannot forget to wipe:

```ts
/** Runs fn with secret bytes and always zero-fills them afterwards, even on throw. */
export async function withSecretBytes<T>(
  bytes: Uint8Array,
  fn: (b: Uint8Array) => Promise<T>
): Promise<T> {
  try { return await fn(bytes); } finally { zeroClearBytes(bytes); }
}
```

3. Represent every secret this module produces as `Uint8Array`: `etkSecret` (via `generateEtkSecret`/`parseAgentToken`) and DEKs. The token string itself is unavoidably a string. The module only promises to wipe bytes it owns.
4. Add this header comment to the module (it is a non-obvious constraint, so a comment is warranted):

```ts
// JavaScript strings are immutable and cannot be wiped. Every secret this module
// produces is a Uint8Array so callers can zero it with zeroClearBytes(). Strings
// that unavoidably carry secrets (the token text, child-process env values) live
// until garbage collection; keep their lifetime short and drop references.
```

**Tests.** Remove the string half of the zero-clear test. Add tests showing that `withSecretBytes` zeroes on success **and** on throw.

**Acceptance criteria.**

- [ ] `zeroClearStrings` no longer exists anywhere in the repo (excluding `dist`).
- [ ] No public function in `zero-knowledge.ts` accepts or returns a secret as `string`, except token text parse/format.

---

### Phase 4 — Harden the crypto module (execute second)

#### #309 — Malformed base64 in `base64ToBytes`

**Problem.** `zero-knowledge.ts:56-67`: `atob` throws a `DOMException`, and `Buffer.from(…, 'base64')` silently drops bad characters. The two runtimes behave differently.

**Solution.**

```ts
const B64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof b64 !== 'string' || !B64_RE.test(b64)) {
    throw new ZeroKnowledgeError('invalid_encoding', 'Invalid base64 input');
  }
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
```

- The strict regex runs first, so both paths only ever see canonical, padded base64. The round-trip check from the issue is not needed.
- Error messages never include the input.
- Also add strict `hexToBytes`/`bytesToHex` (`/^(?:[0-9a-f]{2})+$/`) for the `etk_` segment.
- Export `bytesToBase64`, `base64ToBytes`, `hexToBytes`, and `bytesToHex` (they carry no secret state) so tests and the CLI can reuse them.

**Tests.** Invalid characters (`'@@@@'`), bad padding (`'abc'`, `'a==='`), whitespace, and the empty string (valid, returns 0 bytes). Run each test in both branches by stubbing `globalThis.Buffer` to `undefined` with `vi.stubGlobal`.

**Acceptance criteria.**

- [ ] Every malformed input throws `ZeroKnowledgeError('invalid_encoding')` in both Node and browser paths.
- [ ] `decryptPayload`, `unwrapDEK`, `unwrapDekFromMap`, `unwrapRowDek`, and `decryptRowField` surface that error code, not a raw `DOMException`.

---

#### #310 — `toArrayBuffer` and `SharedArrayBuffer`

**Problem.** `zero-knowledge.ts:34-36` slices `view.buffer`. For a `SharedArrayBuffer` that returns a `SharedArrayBuffer`, and the `as ArrayBuffer` cast hides it.

**Solution.**

```ts
function toArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return out;
}
```

When the copy holds key material (inputs to `importKey`), zero it after the import resolves: `new Uint8Array(copy).fill(0)`. `importKey` takes its own internal copy, so wiping ours is safe.

**Tests.** A subarray view with a non-zero `byteOffset` encrypts and decrypts correctly. A view backed by `new SharedArrayBuffer(32)` works for `encryptPayload`. Skip that case with `it.skipIf(typeof SharedArrayBuffer === 'undefined')`.

**Acceptance criteria.**

- [ ] No `as ArrayBuffer` casts remain in the module.
- [ ] SAB-backed and offset views produce correct results.

---

#### #311 — Algorithm validation in `unwrapDekFromMap`

**Problem.** `zero-knowledge.ts:263-271` never checks `entry.algorithm`.

**Solution.**

```ts
async unwrapDekFromMap(
  map: WrappedDekMap, resourceKey: AetResourceKey, etkSecret: Uint8Array, salt: Uint8Array
): Promise<Uint8Array | null> {
  const entry = map?.[resourceKey];
  if (!entry) return null;                                   // not granted: not an error
  if (entry.algorithm !== 'AES-256-GCM') {
    throw new ZeroKnowledgeError('unsupported_algorithm', 'Unsupported key wrapping method');
  }
  const iv = base64ToBytes(entry.iv);
  const ct = base64ToBytes(entry.wrappedDek);
  if (iv.byteLength !== 12 || ct.byteLength !== 48) {
    throw new ZeroKnowledgeError('invalid_envelope', 'Malformed key entry');
  }
  const key = await deriveAetWrappingKey(etkSecret, salt);
  try {
    const dek = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: utf8(resourceKey) },
      key, toArrayBuffer(ct)));
    if (dek.byteLength !== 32) throw new Error();
    return dek;
  } catch {
    throw new ZeroKnowledgeError('decrypt_failed', 'Could not unlock this item');
  }
}
```

Also add `validateAetEnvelope(e: unknown): AetEnvelope`, which throws `invalid_envelope`. It checks `v === 1`, `alg`, `kdf`, that `salt` decodes to 16 bytes, at most 500 entries, that keys match `/^(credential|totp|note):[A-Za-z0-9_-]{1,64}$/`, and that every entry has the shape above. The server calls it at mint time (§4 #301). Clients call it after fetching the envelope.

The error messages are deliberately generic. Do not reveal which check failed beyond the code.

**Tests.** A tampered `algorithm` throws `unsupported_algorithm`. A wrong-length IV or ciphertext throws `invalid_envelope`. A swapped entry (A's entry stored under B's key) throws `decrypt_failed`, which proves the AAD binding. A missing key returns `null`.

**Acceptance criteria.**

- [ ] Every field of every entry is validated before decrypting.
- [ ] Moving an entry to a different `resourceKey` fails to decrypt.

---

#### #313 — Ambiguous `dekBytes: Uint8Array | string`

**Problem.** `encryptPayload`/`decryptPayload` (`zero-knowledge.ts:151-196`) accept a string and SHA-256 it. A base64 DEK passed as a string silently yields a different key.

**Solution.**

- Change the signatures to `encryptPayload(dek: Uint8Array, plaintext: string | Record<string, unknown>)` and `decryptPayload(dek: Uint8Array, encryptedData: string, iv: string)`.
- Import the DEK **raw**, with no hashing, through `importAesKey(dek, usages)`. That function throws `invalid_key_length` unless `dek.byteLength === 32`.
- Apply the same rule to `wrapDEK`/`unwrapDEK`: the wrapping key must be a `Uint8Array(32)`. Prefer the explicit `deriveAetWrappingKey` path for AET use.
- **Ciphertext compatibility:** the old code hashed the key, so payloads encrypted by the PR #299 functions cannot be decrypted by the new ones. Nothing persisted them (no caller outside the test, and AET minting never ran). Confirm with `grep -rn "encryptPayload\|wrapDEK\|createWrappedDekMap" --exclude-dir=node_modules --exclude-dir=dist .` before merging. If a real caller turns up, stop and report it instead of shipping.

**Tests.** Passing a string throws a `TypeError` or `invalid_key_length` (guard at runtime with `instanceof Uint8Array`, since TS types do not protect JS callers). 16-byte and 64-byte keys throw `invalid_key_length`.

**Acceptance criteria.**

- [ ] No exported function takes a key or secret as `string`.
- [ ] Raw 32-byte DEKs interoperate with `lib/api/vault-crypto.ts` field ciphertexts through `decryptRowField`.

---

#### #314 — `deriveKeyFromSecret` has no KDF

**Problem.** `zero-knowledge.ts:87-98` uses a single unsalted SHA-256 over any string or bytes.

**Solution.**

- **Delete** `deriveKeyFromSecret`. Replace it with:
  - `importAesKey(raw: Uint8Array /* 32 bytes */, usages)` for DEKs (no KDF needed; DEKs are uniform random).
  - `deriveAetWrappingKey(etkSecret: Uint8Array /* 32 bytes */, salt: Uint8Array /* 16 bytes */)`, which runs HKDF-SHA256 with `info = "kylrix/aet/dek-wrap/v1"`. HKDF is the correct primitive for high-entropy input. It adds domain separation and per-token salt at negligible cost.
- **Do not** add a password KDF to this module. Password-based derivation already exists in `lib/masterpass-crypto.ts` (Argon2id with a PBKDF2-600k fallback, `:20-92`). A second implementation invites drift. Low-entropy input is rejected by construction, because only `Uint8Array(32)` is accepted.
- Doc comment on `deriveAetWrappingKey`: "Input must be 32 random bytes. Never pass a password; use lib/masterpass-crypto.ts for passwords."

**Tests.** Same etk + salt gives the same key (encrypt with one, decrypt with the other). A different salt fails to decrypt. A non-32-byte etk throws.

**Acceptance criteria.**

- [ ] No SHA-256-as-KDF remains in `zero-knowledge.ts`.
- [ ] The wrapping key is HKDF-derived with a per-envelope salt.

---

### Phase 2 — Core AET functionality

#### #301 — AET minting in `CreatePatDrawer` (ships together with #317)

**Problem.** `handleCreate` (`components/settings/CreatePatDrawer.tsx:281-312`) ignores the AET state at `:196-201` and mints a normal PAT.

**Files.**

| File | Change |
|---|---|
| `components/settings/CreatePatDrawer.tsx` | AET branch in `handleCreate`; vault-locked state; done-step copy |
| `lib/security/aet-mint.ts` (new, client-only) | `buildAetEnvelope({ mek, rows, resources })` |
| `lib/actions/client-ops.ts:714-726` | `createPat` accepts `aetEnvelope?: AetEnvelope` |
| `lib/actions/secure-ops/pats.ts:9-31` | pass `aetEnvelope` through |
| `lib/services/pats.ts:174-267` | validate and persist envelope; AET token format |

**Solution — client.**

```ts
// lib/security/aet-mint.ts  ('use client' consumers only; no server imports)
export async function buildAetEnvelope(params: {
  mek: CryptoKey;
  rows: Array<{ kind: AetResourceKind; id: string; row: Record<string, unknown> }>;
  resources: AetEnvelope['resources'];
  etkSecret: Uint8Array;
}): Promise<{ envelope: AetEnvelope; included: number; skipped: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveAetWrappingKey(params.etkSecret, salt);
  const deks: WrappedDekMap = {};
  let skipped = 0;
  for (const { kind, id, row } of params.rows.slice(0, 500)) {
    const wrapped = getRowWrappedDek(row);
    if (!wrapped) { skipped++; continue; }            // legacy MEK-direct Row: cannot share
    let dek: Uint8Array | null = null;
    try {
      dek = await unwrapRowDek(wrapped, params.mek);
      deks[`${kind}:${id}`] = await wrapEntry(wrapKey, dek, `${kind}:${id}`);
    } catch { skipped++; }
    finally { zeroClearBytes(dek); }
  }
  skipped += Math.max(0, params.rows.length - 500);
  return {
    envelope: { v: 1, alg: 'AES-256-GCM', kdf: 'HKDF-SHA256', salt: bytesToBase64(salt),
                resources: params.resources, createdAt: new Date().toISOString(), deks },
    included: Object.keys(deks).length,
    skipped,
  };
}
```

Row sources, read through the same data layer the vault pages use:

- credentials: the vault list used by `app/(app)/vault/...` pages and `components/app/dashboard/CredentialItem.tsx`;
- TOTP: the source used by `app/(app)/vault/(protected)/totp/TOTPContent.tsx`;
- notes: only notes with `is_encrypted = 1` and a `dek` (`turso-schema.sql:420`). Verify the note field ciphertext format against `.agents/skills/note/SKILL.md` first. If it differs from `encryptFieldWithKey`, ship credentials and TOTP only, and hide the notes toggle (do not show a broken option).

Respect workspace scoping. When the drawer opens with `isWorkspace && workspaceId`, include only Rows linked to that workspace through `workspace_objects` (the same rule as `useWorkspaceFilteredItems`). Otherwise include only personal Rows. See `.agents/skills/workspace/SKILL.md`.

`handleCreate` AET branch:

```ts
if (isAetToken) {
  const mek = masterPassCrypto.getMasterKey();
  if (!mek || !masterPassCrypto.isVaultUnlocked()) { setNeedsUnlock(true); return; }
  const etk = generateEtkSecret();
  try {
    const rows = await loadPermittedRows({ permittedVault, permittedTotp, permittedNotes, isWorkspace, workspaceId });
    const { envelope, included, skipped } = await buildAetEnvelope({
      mek, rows, etkSecret: etk,
      resources: { credential: permittedVault, totp: permittedTotp, note: permittedNotes },
    });
    if (included === 0) { toast.error('None of the chosen items can be shared yet.'); return; }
    const res = await createPat({
      name: name.trim(),
      scopes: computeAetScopes(selected, { permittedVault, permittedTotp, permittedNotes }), // #317
      expiresAt: aetExpiryDays > 0 ? new Date(Date.now() + aetExpiryDays * 86_400_000).toISOString() : null,
      keyCategory: 'agent_enclave_token',
      isWorkspace, workspaceId,
      aetEnvelope: envelope,
    });
    setToken(formatAgentToken(res.token, etk));
    setShareSummary({ included, skipped });
    setStep('done');
  } finally {
    zeroClearBytes(etk);
  }
}
```

- When the vault is locked, show an inline panel in place of the Mint button: "Unlock your vault to continue", with a button that opens the existing vault unlock UI (reuse it; do not build a new one).
- The done step for AETs shows: "Agent key created. It can open {included} items." When `skipped > 0`, add: "{skipped} older items could not be included. Open and save them once to make them shareable." The existing "won't be able to view again" warning stays.
- On close (`onClose`) and on unmount, call `setToken(null)`.

**Solution — server.**

```ts
// PatService.create params
aetEnvelope?: unknown;

// inside create(), after category is resolved
let aet: AetEnvelope | null = null;
if (category === 'agent_enclave_token') {
  aet = validateAetEnvelope(params.aetEnvelope);                  // throws invalid_envelope
  if (JSON.stringify(aet).length > 196_608) throw new Error('Too many items for one agent key');
}
// metadata
metadata: JSON.stringify({ agentId: params.agentId || null, ...(aet ? { aet } : {}) }),
```

- The server can validate shape only. It cannot and must not try to verify the cryptography.
- `toPublic` (`:138-155`) and `listForUser` must never include `metadata.aet`. They do not today; add a test to keep it that way.
- `lib/api/resources.ts:1060-1070` (`POST /api/v1/pats`) must **not** accept `aetEnvelope` or `keyCategory: 'agent_enclave_token'` in this phase. AET minting needs the MEK, so it is browser-only. This keeps the HTTP API surface unchanged.

**Tests.**

- `lib/security/aet-mint.test.ts`: build an envelope from Rows sealed with `sealRowFields` (`vault-crypto.ts:196`), then unwrap each entry with `unwrapDekFromMap` and decrypt fields with `decryptRowField`. The plaintext must match. Rows without a DEK are counted in `skipped`. More than 500 Rows caps at 500.
- `lib/services/pats.test.ts`: `create` with `agent_enclave_token` and a valid envelope stores `metadata.aet`, and the returned token matches `AET_BEARER_REGEX`. An invalid envelope throws. `toPublic` output has no `aet`.

**Acceptance criteria.**

- [ ] With the AET toggle on, the drawer produces a `kyl_aet_…` string that `parseAgentToken` accepts.
- [ ] The `apikey` Row has `category = 'agent_enclave_token'`, `key = sha256(bearer)`, the chosen `expires_at`, and `metadata.aet` with one entry per included Row.
- [ ] No request body sent by the browser contains `etk_` or the raw `etkSecret` bytes (verify in the Network tab during the manual E2E).
- [ ] A locked vault blocks minting with a clear message. No partial PAT is created.

---

#### #317 — Map AET resource toggles to PAT scopes (ships with #301)

**Problem.** `permittedVault`/`permittedTotp`/`permittedNotes` have no effect on scopes.

**Decision.** The resource toggles **add** the read scopes they need, and the scopes step **locks** those scopes on. The issue suggested intersecting with the user's selection instead. Intersection would let a user mint an AET that holds keys for items it is not allowed to read, which is a silent failure. Forcing the required read scopes keeps the toggles and the token consistent.

```ts
// CreatePatDrawer.tsx (exported for tests)
export const AET_RESOURCE_SCOPES = {
  vault: ['vault:read'],
  totp: ['vault:read'],        // TOTP routes require vault:read (lib/api/resources.ts:3085, :3151)
  notes: ['notes:read'],
} as const satisfies Record<string, readonly PatScope[]>;

export function computeAetRequiredScopes(p: { permittedVault: boolean; permittedTotp: boolean; permittedNotes: boolean }): PatScope[] {
  const s = new Set<PatScope>(['profile:read']);
  if (p.permittedVault) AET_RESOURCE_SCOPES.vault.forEach((x) => s.add(x));
  if (p.permittedTotp) AET_RESOURCE_SCOPES.totp.forEach((x) => s.add(x));
  if (p.permittedNotes) AET_RESOURCE_SCOPES.notes.forEach((x) => s.add(x));
  return [...s];
}

export function computeAetScopes(selected: PatScope[], p: Parameters<typeof computeAetRequiredScopes>[0]): PatScope[] {
  return normalizeScopes([...selected, ...computeAetRequiredScopes(p)]);
}
```

UI rules:

- When moving from `wizard_step2` to `scopes`, merge the required scopes into `selected`.
- In the scopes step, required scopes show as on and disabled, with the hint "Needed for the items you chose".
- The step-1 Next button is disabled when all three toggles are off.
- Sweep presets (`applySweepPreset`) and "Clear" never remove required scopes while `isAetToken` is on.

**Tests** (`components/settings/CreatePatDrawer.test.ts`): each toggle combination yields the exact set. `computeAetScopes` keeps extra user scopes and adds no write scopes.

**Acceptance criteria.**

- [ ] An AET always carries the read scopes for every resource kind in its envelope.
- [ ] No write scope is added automatically.

---

#### #302 — Register `kylrix agents connect`

**Files.** `packages/cli/src/index.ts:84-89` (import) and `:535-560` (agents group).

**Solution.**

```ts
agents
  .command('connect [command...]')
  .description('Check an agent key and start Claude Code, Cursor, or any command with it loaded')
  .option('--claude-code', 'Start Claude Code (claude) with the agent key')
  .option('--cursor', 'Start Cursor Agent (cursor-agent) with the agent key')
  .option('--check', 'Only check the agent key and show what it can open')
  .allowUnknownOption()
  .action((command, cmdOpts) => connectAgentCommand(command ?? [], { ...program.opts(), ...cmdOpts }));
```

- Do **not** add a per-command `--token`. The global `-t, --token` (`index.ts:119`) is already parsed anywhere on the command line and lands in `program.opts().token`.
- The `[command...]` handling after `--` must follow the same raw-argv approach as `exec` (`index.ts:498-505`).

**Acceptance criteria.**

- [ ] `kylrix agents --help` lists `connect`.
- [ ] `kylrix agents connect --check` runs the real implementation from #303.

---

#### #303 — Implement `connectAgentCommand`

**Problem.** `packages/cli/src/commands/agents.ts:43-76` parses, prints success, and does nothing.

**Files.** `packages/cli/src/commands/agents.ts:43-76`; new `packages/cli/src/enclave.ts`; `packages/cli/src/client.ts` (new `auth.enclave()` and sealed vault reads).

**Solution — shared enclave helper** (`packages/cli/src/enclave.ts`, also used by #308):

```ts
export interface OpenEnclave {
  bearer: string;
  envelope: AetEnvelope;
  scopes: string[];
  expiresAt: string | null;
  /** Unwraps one DEK; caller must zeroClearBytes() the result. */
  unlockDek(key: AetResourceKey): Promise<Uint8Array | null>;
  /** Zeroes etkSecret and salt. Idempotent. */
  close(): void;
}

export async function openEnclave(rawToken: string, opts: { url?: string }): Promise<OpenEnclave> {
  const parsed = parseAgentToken(rawToken);                     // throws ZeroKnowledgeError
  assertSecureTransport(resolveEnvironment(opts).apiUrl);       // §11 TLS rule
  const client = getClient({ url: opts.url, token: parsed.bearer });
  const info = await client.auth.enclave();                     // GET /api/v1/token/enclave
  const envelope = validateAetEnvelope(info.envelope);
  const salt = base64ToBytes(envelope.salt);
  let closed = false;
  return {
    bearer: parsed.bearer, envelope, scopes: info.scopes, expiresAt: info.expiresAt,
    unlockDek: (key) => ZeroKnowledgeModule.unwrapDekFromMap(envelope.deks, key, parsed.etkSecret, salt),
    close: () => { if (closed) return; closed = true; zeroClearBytes(parsed.etkSecret); zeroClearBytes(salt); },
  };
}

export function assertSecureTransport(apiUrl: string) {
  const u = new URL(apiUrl);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) {
    throw new Error('Agent keys can only be used over a secure (https) connection.');
  }
}
```

Server endpoint (also part of this phase): `GET /api/v1/token/enclave`, wired in `lib/api/v1/dispatch.ts` next to the existing `token` routes, and implemented with Drizzle in `PatService.getEnclaveEnvelope(patId, userId)`:

- Requires `actor.kind === 'pat'` and `actor.category === 'agent_enclave_token'`. Otherwise it returns 403 `not_an_agent_key`.
- Returns `{ envelope, scopes, expiresAt }` for **the authenticating token only**. There is no `patId` parameter.
- Response header `Cache-Control: no-store`.

Sealed reads: add `?sealed=1` to `GET /api/v1/vault/items`, `/api/v1/vault/:id`, and the TOTP list/get routes. It is allowed **only** for `agent_enclave_token` actors (403 otherwise). It returns the item's non-secret metadata plus `sealed: { <field>: <ciphertext> }` for `VAULT_ENCRYPTED_FIELDS.*` (`lib/api/vault-crypto.ts:171-191`). It never returns the MEK-wrapped `dek`, because the agent cannot use it and it is not needed. Implement this by extending `shapeVaultItem` with a `sealed` option. Do not duplicate the list logic.

**Solution — command:**

```ts
export async function connectAgentCommand(command: string[], opts: {
  url?: string; token?: string; claudeCode?: boolean; cursor?: boolean; check?: boolean;
}) {
  const raw = (opts.token && isAgentEnclaveToken(opts.token) ? opts.token : process.env.KYLRIX_AGENT_KEY) || '';
  if (!raw) { printError('No agent key found. Set KYLRIX_AGENT_KEY or pass --token.'); process.exit(1); }
  if (opts.token && isAgentEnclaveToken(opts.token)) {
    console.warn(pc.yellow('Your agent key may be saved in shell history. Prefer: export KYLRIX_AGENT_KEY=…'));
  }
  let enclave: OpenEnclave | null = null;
  try {
    enclave = await openEnclave(raw, opts);
    const keys = Object.keys(enclave.envelope.deks) as AetResourceKey[];
    const probe = keys[0] ? await enclave.unlockDek(keys[0]) : null;   // proves the unlock part is right
    zeroClearBytes(probe);
    printAgentKeySummary(enclave, keys);       // counts per kind, expiry, scopes; never the key itself

    const bin = opts.claudeCode ? ['claude'] : opts.cursor ? ['cursor-agent'] : command;
    if (opts.check || bin.length === 0) return;

    const childEnv = { ...process.env, KYLRIX_AGENT_KEY: raw };
    delete childEnv.KYLRIX_TOKEN;              // the child signs in with the agent key only
    enclave.close();                           // the parent no longer needs the unlock bytes
    const child = spawn(bin[0], bin.slice(1), { stdio: 'inherit', env: childEnv });
    child.on('error', (e) => { printError(`Could not start ${bin[0]}`, e); process.exit(127); });
    child.on('exit', (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 0));
  } catch (err) {
    printError('Could not connect agent key', err);   // printError must not print the token
    process.exit(1);
  } finally {
    enclave?.close();
  }
}
```

Notes:

- The child receives the full AET in its env so that tools it launches (for example `kylrix exec` or a future `kylrix mcp` with enclave support) can unlock items client-side. Env is visible to processes of the same OS user. That is documented, and acceptable for the threat model (§11.1).
- `spawn` is called without `shell: true`. The harness binary is a fixed name.
- Delete the unused `childEnv` declaration and both string "clears" (resolves #318, below).

**Tests** (`packages/cli/src/enclave.test.ts`, mocked fetch):

- `openEnclave` with a valid AET and envelope works, and `unlockDek` returns the DEK.
- A wrong unlock part makes `unlockDek` throw `decrypt_failed`.
- An `http://` non-local URL throws before any fetch.
- `close()` zeroes `etkSecret` (keep a reference before closing and assert all zeros).
- The `connect --check` path never spawns.

**Acceptance criteria.**

- [ ] `kylrix agents connect --check` with a valid AET prints the item counts and expiry, and exits 0.
- [ ] A wrong unlock part exits 1 with "Could not connect agent key: Could not unlock this item".
- [ ] `--claude-code` starts `claude` with `KYLRIX_AGENT_KEY` set and `KYLRIX_TOKEN` unset.
- [ ] No output line, at any verbosity, contains `etk_` or the auth secret.

---

### Phase 3 — API and CLI integration

#### #307 — `X-Kylrix-Agent-Token` header

**Files.** `lib/api/guard.ts:54-100, 254-275`; new `lib/security/aet-server.ts`; `lib/api/resources.ts` (`listVaultItems` `:2521`, `getVaultItem` `:2588`, `listTotpSecrets` `:3080`, `getTotpSecret` `:3146`); `lib/api/v1/dispatch.ts` (pass enclave through).

**Solution.**

`lib/security/aet-server.ts` (server-only):

```ts
import 'server-only';

export interface EnclaveContext {
  etkSecret: Uint8Array;
  salt: Uint8Array;
  envelope: AetEnvelope;
  issued: Uint8Array[];        // every DEK handed out, zeroed on release
}

const enclaves = new WeakMap<object, EnclaveContext>();

export function attachEnclave(actor: object, ctx: Omit<EnclaveContext, 'issued'>) {
  enclaves.set(actor, { ...ctx, issued: [] });
}
export function getEnclave(actor: object): EnclaveContext | undefined { return enclaves.get(actor); }
export function releaseEnclave(actor: object) {
  const ctx = enclaves.get(actor);
  if (!ctx) return;
  zeroClearBytes(ctx.etkSecret); zeroClearBytes(ctx.salt); ctx.issued.forEach(zeroClearBytes);
  enclaves.delete(actor);
}

/** Decrypts the listed fields of one Row if the envelope grants it; otherwise returns null. */
export async function unsealRowWithEnclave(
  ctx: EnclaveContext, key: AetResourceKey, row: Record<string, unknown>, fields: readonly string[]
): Promise<Record<string, string | null> | null>;
```

A `WeakMap` keeps the secret off the `ApiActor` object, so it can never be serialized by `jsonOk`, error handlers, or logging.

`resolveApiActor` changes:

```ts
const agentHeader = req.headers.get('x-kylrix-agent-token');
if (agentHeader) {
  if (bearer && toBearerCredential(bearer) !== toBearerCredential(agentHeader)) {
    throw httpError(400, 'conflicting_credentials', 'Send either Authorization or X-Kylrix-Agent-Token, not two different keys');
  }
  if (!isSecureRequest(req)) throw httpError(400, 'insecure_transport', 'Agent keys require https');
  let parsed: ParsedAgentToken;
  try { parsed = parseAgentToken(agentHeader); }
  catch { assertShieldAllowed(enforceApiAnonShield(req)); throw httpError(401, 'invalid_agent_token', 'Invalid agent key'); }
  const verified = await PatService.verifyBearer(parsed.bearer);
  if (!verified || verified.pat.category !== 'agent_enclave_token') {
    zeroClearBytes(parsed.etkSecret);
    assertShieldAllowed(enforceApiAnonShield(req));
    throw httpError(401, 'invalid_agent_token', 'Invalid or revoked agent key');
  }
  // …same burst shield + rate limits as the PAT path…
  const envelope = await PatService.getEnclaveEnvelope(verified.pat.$id, verified.userId);
  const actor: ApiActor = { /* kind: 'pat', category: 'agent_enclave_token', isAgent: true, … */ };
  attachEnclave(actor, { etkSecret: parsed.etkSecret, salt: base64ToBytes(envelope.salt), envelope });
  return actor;
}
```

- `isSecureRequest(req)` returns true when `x-forwarded-proto` (or `req.nextUrl.protocol`) is `https`, or when the host is `localhost`, `127.0.0.1`, or `::1`.
- **Never** read the AET from a query string. (The MEK header *does* accept `?mek=`, `lib/api/v1/context.ts:47`. Do not copy that pattern.)
- `withApiGuard` (`guard.ts:254-275`) gets a `finally { if (actor) releaseEnclave(actor); }`. Restructure it so `actor` is in scope for the `finally` block.

Resource handlers: when `mekBytes` is null and `getEnclave(actor)` exists, call `unsealRowWithEnclave(ctx, 'credential:' + r.$id, r, VAULT_ENCRYPTED_FIELDS.credentials)` and pass the result as `unsealed` to `shapeVaultItem` with `hasMek: true`. Rows not in the envelope return exactly as they do today without a MEK (encrypted indicators, no plaintext). Do the same for TOTP with `VAULT_ENCRYPTED_FIELDS.totpSecrets` and `'totp:'` keys. Notes routes follow only if notes were enabled in #301.

Any response that contains enclave-decrypted plaintext sets `Cache-Control: no-store` and `Pragma: no-cache`.

Logging audit (required): search `middleware.ts`, `lib/api/edge-shield.ts`, `lib/api/rate-limits.ts`, the `/api/dev/logs` console hooks, and any request logger for header dumps. If any logger records headers, add `x-kylrix-agent-token` (and `x-kylrix-mek`, `authorization`) to a redaction list. Do not change unrelated logging behavior.

**Tests** (`lib/security/aet-server.test.ts`, plus a guard unit test with mocked `PatService`):

- A valid header attaches an enclave. `releaseEnclave` zeroes `etkSecret` and every issued DEK.
- An invalid header → 401 `invalid_agent_token`. The response body does not contain the header value.
- A bearer and header with different keys → 400 `conflicting_credentials`.
- `http` to a non-local host → 400 `insecure_transport`.
- `unsealRowWithEnclave` on a granted Row returns plaintext. On an ungranted Row it returns `null`. On a tampered entry it returns `null` and does not throw to the caller (the item shows as locked).

**Acceptance criteria.**

- [ ] `curl -H "X-Kylrix-Agent-Token: $AET" https://…/api/v1/vault/items` returns plaintext for granted items, encrypted indicators for the rest, and `Cache-Control: no-store`.
- [ ] The same request with only `Authorization: Bearer <bearer>` returns no plaintext.
- [ ] After a request, no reference to the etk bytes survives (the WeakMap entry is deleted and the bytes are zeroed).
- [ ] The header value never appears in logs, the dev log ring buffer, or error bodies.

---

#### #308 — `kylrix exec --token`

**Files.** `packages/cli/src/commands/exec.ts`; `packages/cli/src/index.ts:492-506`.

**Solution.**

Change the registration to make the source optional, only in AET mode:

```ts
program
  .command('exec [idOrUrl] [command...]')
  // description unchanged
```

Argument resolution (implement in a pure, exported function `resolveExecArgs(argv, idOrUrl, commandArgs, aetMode)` so it is unit-testable):

- If `--` is present and nothing before it except options, then `idOrUrl = undefined` and `command = after '--'`.
- If `--` is present with one positional before it, then `idOrUrl = that positional` and `command = after '--'`.
- Without `--`, keep today's behavior.
- If not in AET mode and `idOrUrl` is missing, print the existing usage error. **Non-AET behavior must be byte-for-byte unchanged.**

AET mode is active when the global `--token` or `KYLRIX_AGENT_KEY` is an AET (`isAgentEnclaveToken`). In AET mode:

1. `openEnclave(raw, opts)`. Warn about shell history if the key came from `--token`.
2. Fetch sealed Rows. If `idOrUrl` is given, use `GET /vault/:id?sealed=1`. Otherwise use `GET /vault/items?sealed=1&limit=100` and page until done (cap 500).
3. For each Row whose `credential:<id>` is in the envelope: `dek = await unlockDek(key)`, decrypt the fields with `decryptRowField`, then `zeroClearBytes(dek)`.
4. Build env variables:
   - If the Row is an env bundle (the same detection `resolveEnvSource` uses in `packages/cli/src/commands/envs.ts:76+`, for example `isEnv`/dotenv in `notes`), parse it with the existing dotenv parser and inject those keys as-is.
   - Otherwise inject `KYLRIX_SECRET_<NAME>_USERNAME`, `_PASSWORD`, `_URL` (only fields that are non-empty). `<NAME>` = `name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')`, falling back to the Row id. On collision, append `_2`, `_3`, and so on.
5. `childEnv = { ...process.env, ...vars }`, then `delete childEnv.KYLRIX_AGENT_KEY` and `delete childEnv.KYLRIX_TOKEN`. The child gets the secrets, not the key that unlocks everything else.
6. `enclave.close()` **before** spawning. Spawn exactly as today (`shell: true` stays for compatibility). On exit, keep the existing reference cleanup, but fix the comment: it drops references and does not wipe memory.
7. Print `Loaded {n} secret(s) from your agent key` (count only, never names or values, unless `--json` is set, in which case print names only).

**Tests** (`packages/cli/src/commands/exec.test.ts`):

- `resolveExecArgs` covers every branch above.
- Name sanitizing and collision suffixes.
- The child env lacks `KYLRIX_AGENT_KEY`/`KYLRIX_TOKEN` (inject a mock `spawn`).
- Non-AET mode calls `resolveEnvSource` exactly as before.

**Acceptance criteria.**

- [ ] `KYLRIX_AGENT_KEY=$AET kylrix exec -- node -e "console.log(Object.keys(process.env).filter(k=>k.startsWith('KYLRIX_SECRET_')))"` lists the granted credentials.
- [ ] `KYLRIX_AGENT_KEY=$AET kylrix exec <envBundleId> -- printenv FOO` prints the bundle's `FOO`.
- [ ] `kylrix exec <id> -- cmd` with a normal PAT behaves exactly as before.
- [ ] The child never receives `KYLRIX_AGENT_KEY`.

---

### Phase 5 — UX polish and tests

#### #306 — Step titles for wizard steps

**Files.** `components/settings/CreatePatDrawer.tsx:31, 332-336`.

**Solution.** An exported pure function, so numbering is right in both flows:

```ts
export function getStepTitle(step: Step, isAet: boolean): string {
  if (!isAet) {
    return ({ name: '1. Name Your Key', scopes: '2. Choose Permissions', done: '3. Save Your Key' } as const)[step as 'name'] ?? '';
  }
  return ({
    name: '1. Name Your Key',
    wizard_step1: '2. Choose What It Can Open',
    wizard_step2: '3. Set an Expiry',
    scopes: '4. Choose Permissions',
    done: '5. Save Your Key',
  } as const)[step];
}
```

Also update the eyebrow (`:329-331`): show `'Agent Key'` when `isAetToken`, otherwise keep the existing text.

**Tests.** Every `Step` returns a non-empty title in AET mode. Non-AET mode numbers 1–3.

**Acceptance criteria.**

- [ ] The header is never blank on any step.

---

#### #312 — Test coverage for the zero-knowledge module

Target **≥ 90% line and branch coverage** of `lib/security/zero-knowledge.ts`, measured with `pnpm vitest run --coverage --coverage.include=lib/security/zero-knowledge.ts lib/security`.

Required cases (some come from other issues; one checklist here):

| Area | Cases |
|---|---|
| Token parse | `''`, `'kyl_aet_'`, `null`, `undefined`, `123`, `{}`; extra dot (`…a.b.c`); empty prefix; empty unlock part; uppercase hex; 7- and 9-char prefix; 63- and 65-char hex; leading/trailing whitespace (accepted, trimmed); legacy `kyl_apk_x.etk_…` → `legacy_token_format`; plain `kyl_apk_…` PAT → `invalid_token` |
| Token format | round trip; bad bearer throws; 31-byte etk throws |
| Encoding | §4 #309 cases in both Buffer and atob paths; hex helpers |
| Payload | empty string; unicode (emoji, RTL); 1 MiB payload; JSON object input; wrong key → `decrypt_failed`; flipped ciphertext byte → `decrypt_failed`; flipped tag byte; wrong IV; IV shorter than 12 bytes → error; 100 encryptions of the same plaintext produce 100 distinct IVs |
| DEK map | missing key → `null`; tampered algorithm; swapped entries (AAD); bad lengths; wrong etk; wrong salt |
| Envelope | `validateAetEnvelope` accepts a valid envelope; rejects `v: 2`, 501 entries, bad key pattern, non-string fields, missing salt |
| Row compat | `unwrapRowDek` + `decryptRowField` against output from `sealRowFields`/`sealVaultSecret` (`lib/api/vault-crypto.ts`), proving interop |
| Views | subarray offset view; SAB view (#310) |
| Concurrency | `Promise.all` over 50 parallel encrypt/decrypt and 50 parallel unwrap calls; all results correct |
| Zeroing | `zeroClearBytes(null/undefined)` no-op; `withSecretBytes` zeroes on success and on throw |

Timing-attack tests are out of scope. WebCrypto AES-GCM tag checks are constant-time by implementation, and the module adds no secret-dependent branches. Document this in the test file header.

**Acceptance criteria.**

- [ ] Coverage ≥ 90% lines and branches.
- [ ] All the cases above exist and pass.

---

#### #315 — VS Code `copyAgentKey` validation

**Files.** `packages/vscode/src/extension.ts:119-128`.

**Solution.**

```ts
vscode.commands.registerCommand('kylrix.copyAgentKey', async () => {
  const key = await vscode.window.showInputBox({
    prompt: 'Paste your Kylrix agent key to copy it',
    placeHolder: 'kyl_aet_…',
    password: true,
    ignoreFocusOut: true,
    validateInput: validateAgentTokenInput,
  });
  if (!key) return;
  await vscode.env.clipboard.writeText(key.trim());
  vscode.window.showInformationMessage('Agent key copied.');
}),
```

Optional (not required for acceptance): after 60 seconds, clear the clipboard if it still holds the key.

**Acceptance criteria.**

- [ ] Malformed, empty, legacy-format, and plain-PAT inputs are rejected inline with plain-language messages.
- [ ] The value is masked while typing.

---

#### #316 — Keep wizard choices when the drawer closes

**Problem.** The `useEffect` at `CreatePatDrawer.tsx:219-228` resets state every time the drawer opens. Parents may also unmount it.

**Solution.** Store a **non-secret** draft in `sessionStorage`. This keeps the global unmount policy intact (no `keepMounted: true`).

```ts
const DRAFT_KEY = (ws: string | null) => `kylrix:create-pat-draft:v1:${ws ?? 'personal'}`;

export interface PatDraft {
  step: Exclude<Step, 'done'>;
  name: string;
  selected: PatScope[];
  isAetToken: boolean;
  permittedVault: boolean;
  permittedTotp: boolean;
  permittedNotes: boolean;
  aetExpiryDays: number;
}

export function serializeDraft(d: PatDraft): string { return JSON.stringify(d); }
export function parseDraft(raw: string | null): PatDraft | null { /* validate every field; normalizeScopes(selected); fall back to null */ }
```

- On open: if a draft exists, restore it (and show a small "Start over" text button in the header). Otherwise apply the current defaults.
- On every change of the fields above: write the draft (skip while `step === 'done'`).
- On a successful mint or "Start over": remove the draft.
- **Never** store `token`, the etk, or anything derived from vault Rows. `PatDraft` has no field that could hold one, and `parseDraft` drops unknown keys.
- Wrap all `sessionStorage` access in try/catch (private mode or disabled storage must not break the drawer).

**Tests.** A `parseDraft(serializeDraft(d))` round trip. Garbage input and unknown keys are dropped. Injected `token` and `etk` fields are absent after parsing.

**Acceptance criteria.**

- [ ] Fill steps 1–2, close, reopen: the same step and choices are back.
- [ ] After a successful mint, reopening starts fresh.
- [ ] `sessionStorage` never contains `kyl_aet_` or `etk_`.

---

#### #318 — Redundant and ineffective clears in `connectAgentCommand`

Resolved by the rewrite in #303. Checklist:

- [ ] No `etkSecret = ''` assignments remain.
- [ ] The unused `childEnv` declaration is gone.
- [ ] Secret bytes are zeroed exactly once, in `OpenEnclave.close()`, which is idempotent and called from `finally`.

---

### Phase 6 — Documentation

#### #319 — Docs describe unimplemented features

**Files and changes.**

| File | Lines | Change |
|---|---|---|
| `README.md` | 38-69 | Rewrite to shipped behavior: `kyl_aet_` format; `KYLRIX_AGENT_KEY`; `kylrix agents connect --claude-code`; `kylrix exec -- cmd`; header section clearly labeled "server-assisted" with the trade-off in one sentence |
| `docs/security-and-vault.md` | 65-104 | Replace with: key hierarchy (§2.1), envelope format (§2.3), both unlock modes, limits (500 items, rows created later are not included, legacy rows are skipped), honest memory section (bytes zeroed; strings and child env cannot be wiped) |
| `components/settings/CreatePatDrawer.tsx` | 386-388, 505-512 | Plain-language copy (§8.4) |
| `.agents/skills/security/SKILL.md` | append | Quirks list (§12.4) |
| `.agents/skills/agents/SKILL.md` | append | `kyl_apk_` vs `kyl_aet_` distinction; `agents connect` behavior |

Rules:

- Only document what passed acceptance in Phases 1–5. If anything slipped (for example, notes support), label it "Not available yet" in the docs, rather than describing it.
- Use placeholder values in examples (`kyl_aet_xxxxxxxx_…`). Never paste a real-looking secret.
- Leave `kyl_apk_` mentions that describe Agent Provisioning Keys unchanged (for example `components/overlays/LoginDrawer.tsx:772`, `components/settings/AgenticSettingsDrawer.tsx:933-1204`, `docs/AGENTS.md`).

**Acceptance criteria.**

- [ ] Every command and header in the README works as written against a local server.
- [ ] No doc claims strings are wiped from memory.

---

## 5. Token Format Specification (reference)

| Function | Module | Signature | Notes |
|---|---|---|---|
| `generateEtkSecret` | `lib/security/zero-knowledge.ts` | `() => Uint8Array` | 32 random bytes |
| `formatAgentToken` | same | `(bearer: string, etk: Uint8Array) => string` | validates both parts |
| `parseAgentToken` | same | `(input: unknown) => ParsedAgentToken` | throws `ZeroKnowledgeError` |
| `isAgentEnclaveToken` | same | `(v: unknown) => v is string` | no throw |
| `toBearerCredential` | same | `(v: string) => string` | strips the unlock part from AETs only |
| `validateAgentTokenInput` | same | `(v: string) => string \| null` | UI validator, plain language |
| `formatPatToken` | `lib/services/pats.ts` | `(prefix, secret, 'agent_enclave_token')` | `kyl_aet_<prefix>_<secret>` |
| `parsePatToken` | same | accepts bearer or full AET | `token` is always the bearer |

Prefix routing table (authoritative):

| Prefix | Category | Contains `.`? |
|---|---|---|
| `kyl_pat_` / `pat_` | `user_pat` | no |
| `kyl_apk_` | `agent_provisioning_key` | no (if it has `.`, reject as `legacy_token_format`) |
| `kyl_apat_` | `agentic_pat` | no |
| `kyl_wpat_` | `workspace_pat` | no |
| `kyl_punch_` | `punch_token` | no |
| `kyl_aet_` | `agent_enclave_token` | bearer: no; full AET: exactly one |

---

## 6. API Changes (reference)

| Method & path | Auth | New? | Behavior |
|---|---|---|---|
| `GET /api/v1/token/enclave` | AET bearer | new | `{ envelope, scopes, expiresAt }` for the calling token; 403 for other categories; `no-store` |
| `GET /api/v1/vault/items?sealed=1` | AET bearer | new param | ciphertext fields under `sealed`; 403 for non-AET |
| `GET /api/v1/vault/:id?sealed=1` | AET bearer | new param | same |
| TOTP list/get `?sealed=1` | AET bearer | new param | same, TOTP fields |
| Any vault/TOTP read with `X-Kylrix-Agent-Token` | header | new header | plaintext for granted Rows; `no-store` |
| `POST /api/v1/pats` | unchanged | — | must reject `keyCategory: 'agent_enclave_token'` and ignore `aetEnvelope` |

Error codes added: `invalid_agent_token` (401), `not_an_agent_key` (403), `conflicting_credentials` (400), `insecure_transport` (400), `invalid_envelope` (400, mint only).

Server rules:

1. Never log, persist, cache, or echo `X-Kylrix-Agent-Token`, `etkSecret`, or unwrapped DEKs.
2. Never accept an AET from a query string or body.
3. The etk lives only in the `aet-server.ts` WeakMap, for one request, and is zeroed in `withApiGuard`'s `finally`.
4. Plaintext responses are `Cache-Control: no-store`.
5. `verifiedPatCache` (`lib/services/pats.ts:157`) caches by bearer hash only. Never add the etk or the envelope to that cache.

---

## 7. CLI Changes (reference)

| Command | Change |
|---|---|
| `kylrix login --token <AET>` | stores bearer only; prints a note that the unlock part is not saved |
| `kylrix whoami` | labels AETs |
| `kylrix agents connect [--check] [--claude-code\|--cursor] [-- cmd…]` | new (#302/#303) |
| `kylrix exec [idOrUrl] -- cmd…` with AET | new mode (#308); non-AET mode unchanged |
| all commands | `Authorization` header always uses `toBearerCredential(token)` |

Secret handling rules for the CLI:

- Read the AET from `KYLRIX_AGENT_KEY` by preference. Warn when it comes from `--token` (shell history, `ps`).
- `etkSecret` and DEKs are `Uint8Array`, zeroed in `finally` or `close()`.
- Decrypted values must become strings to enter a child env. Keep them only in `childEnv`, never in long-lived structures, and drop references after spawn and exit.
- Refuse non-https API URLs except loopback.
- `printError` must not print token values. Audit `packages/cli/src/formatter.ts`: if it prints `err.config`/request headers, strip them.
- Version bump: `packages/cli/package.json` and `packages/cli/src/updater/index.ts` (`CURRENT_VERSION`), currently `1.0.20`. Then `pnpm --filter @kylrix/cli build`.

---

## 8. UI Changes (reference)

### 8.1 Wizard flow (AET on)

```
1. Name Your Key ──► 2. Choose What It Can Open ──► 3. Set an Expiry ──► 4. Choose Permissions ──► 5. Save Your Key
       │                     (≥1 toggle required)        (7/30/90/365/none)    (required scopes locked)
       └── AET off ──► 2. Choose Permissions ──► 3. Save Your Key
```

### 8.2 State

| State | Persisted in draft? | Notes |
|---|---|---|
| `step` (not `done`), `name`, `selected`, `isAetToken`, `permitted*`, `aetExpiryDays` | yes | §4 #316 |
| `token` | **never** | cleared on close/unmount |
| `etkSecret` | **never** (not even React state) | local variable inside `handleCreate`, zeroed in `finally` |
| `shareSummary` (`included`, `skipped`) | no | done step only |
| `needsUnlock` | no | shows unlock panel |

### 8.3 Drawer constraints

The drawer keeps `keepMounted={false}`, `disablePortal`, and `ModalProps={{ keepMounted: false }}` (`CreatePatDrawer.tsx:319-321`). Parents keep rendering it conditionally. Any new overlay (such as the vault unlock UI) follows the same rules.

### 8.4 Copy (plain language)

| Location | Current | New |
|---|---|---|
| Toggle title `:377` | Agent Enclave Token (AET) | Agent key with access to private items |
| Toggle help `:386-388` | Enable Zero-Knowledge secret access. Generates a client-side `kyl_apk_...` token with an ephemeral secret key (`etkSecret`). | Lets an AI agent read the private items you choose. Only you and the agent can open them; Kylrix cannot. |
| Next button `:397` | Next: Zero-Knowledge Wizard | Next: Choose items |
| Step 1 help `:408` | …decrypt using client-side wrapped DEKs. | Choose which private items this agent key can open. |
| Notes row `:450` | Zero-Knowledge locked document bodies | Private notes you have locked |
| Step 2 callout `:505-512` | Zero-Knowledge Guarantee … `etkSecret` … `kyl_apk_...` … | **Private by design.** Your browser prepares a key that only this agent can use. Kylrix stores a locked copy and cannot open your items. |
| Done (AET) | Secret key generated! | Agent key created. It can open {n} items. Copy it now; you will not see it again. |

Product and code names in monospace (such as `kyl_aet_`) may stay in developer-facing help text inside the scopes step only.

---

## 9. VS Code Extension Changes (reference)

| Command | Change |
|---|---|
| `kylrix.injectTerminalSecrets` | new transient terminal with `env`; masked, validated input; no `sendText` (#304) |
| `kylrix.copyAgentKey` | masked, validated input (#315) |

Both import `validateAgentTokenInput` from `@/lib/security/zero-knowledge`. Neither logs the value. Neither uses `environmentVariableCollection`.

---

## 10. Test Plan

### 10.1 Unit tests (vitest, `happy-dom` per `vitest.config.ts`)

| File | New/extended | Covers |
|---|---|---|
| `lib/security/zero-knowledge.test.ts` | extended | #300, #305, #309–#314, full #312 matrix |
| `lib/security/aet-mint.test.ts` | new | #301 envelope build, skip logic, interop with `vault-crypto.ts` |
| `lib/security/aet-server.test.ts` | new | #307 enclave lifecycle, unseal |
| `lib/services/pats.test.ts` | extended | #300 format/parse, #301 create/validate, `toPublic` hides envelope |
| `lib/api/guard.test.ts` | new or extended | #300 prefix routing, #307 header paths |
| `components/settings/CreatePatDrawer.test.ts` | extended | #306 titles, #317 scopes, #316 draft |
| `packages/cli/src/enclave.test.ts` | new | #303 `openEnclave`, TLS rule, close |
| `packages/cli/src/commands/exec.test.ts` | new | #308 arg parsing, env build, child env hygiene |
| `packages/vscode/src/extension.test.ts` | extended | #304, #315 with mocked `vscode` |

Run command (targeted; do not run the full build or lint unless the user asks):

```bash
pnpm vitest run lib/security lib/services/pats.test.ts components/settings/CreatePatDrawer.test.ts packages/cli packages/vscode
```

`happy-dom` provides WebCrypto through Node's `globalThis.crypto`. If `crypto.subtle` is missing in a test, add `// @vitest-environment node` at the top of that file rather than polyfilling.

### 10.2 Integration tests (CLI against mocked HTTP)

- Use a fetch mock (the pattern in `packages/cli/src/silos.test.ts`) that serves `/token/enclave` and `/vault/items?sealed=1` from fixtures built with the real `buildAetEnvelope` and `sealRowFields`.
- Assert end to end: an AET goes in, the correct plaintext env comes out, and the mock never sees `etk_` in any header or body.

### 10.3 Manual E2E checklist (user-run server on `localhost:3005`)

No Playwright unless the user asks. The agent may query `GET http://localhost:3005/api/dev/logs?level=error` to check for server errors, and must confirm no log line contains `etk_`.

1. Settings → Developers → Create token → turn on agent key → choose Vault → 30 days → Mint. Copy the key.
2. Network tab: the mint request body has the envelope and no `etk_`.
3. `export KYLRIX_AGENT_KEY=<key>`; `kylrix agents connect --check` shows the item count.
4. `kylrix exec -- printenv | grep KYLRIX_SECRET_` lists the granted credentials.
5. `curl -s -H "X-Kylrix-Agent-Token: $KYLRIX_AGENT_KEY" http://localhost:3005/api/v1/vault/items` returns plaintext for granted items, and the response headers include `Cache-Control: no-store`.
6. `curl -s -H "Authorization: Bearer ${KYLRIX_AGENT_KEY%%.*}" http://localhost:3005/api/v1/vault/items` returns no plaintext.
7. Revoke the key in Settings. Within 60 seconds (`verifiedPatCache` TTL), steps 3–5 fail with 401.
8. VS Code: run "Inject Terminal Secrets", paste the key. A new terminal opens; `history` shows nothing and scrollback shows nothing.
9. Close the drawer mid-wizard and reopen: the choices are restored.
10. `grep -r "etk_" ~/.kylrix` returns nothing.

---

## 11. Security

### 11.1 Threat model

| Adversary / event | Gets | Can they read granted items? | Mitigation |
|---|---|---|---|
| Database leak (Turso dump) | envelopes, bearer hashes | **No**: needs the etk | etk is never stored server-side |
| Leaked bearer part only | API access within scopes | **No**: ciphertext only | revoke; short expiry |
| Leaked full AET | bearer + etk | **Yes**, granted items until revoked or expired | default 30-day expiry; revoke; one key per agent |
| Compromised server, client-side mode | envelopes, ciphertext | **No** | AAD binding stops entry swapping; server can only withhold or serve stale data |
| Compromised server, header mode | etk for the request duration | **Yes**, for requests it handles | documented trade-off; header mode is opt-in; prefer CLI |
| Log aggregation / proxies | whatever is logged | only if the AET is logged | never log headers; no query-string AETs; logging audit (§4 #307) |
| Terminal observer / shell history | scrollback, history | **No** after #304 | env-only injection; warn on `--token` |
| Other processes of the same OS user | child env (`/proc/<pid>/environ`) | **Yes** | inherent to env vars; documented; same trust boundary as `~/.kylrix` |
| Network attacker | traffic | **No** | https required except loopback |
| Stale envelope (DEK rotated) | — | affected items fail to open | fails closed (`decrypt_failed` → shown as locked) |

### 11.2 Security checklist (tick all before closing the epic)

- [ ] `etkSecret` and DEKs are `Uint8Array` everywhere and zeroed in `finally`/`close()`.
- [ ] No function in `zero-knowledge.ts` accepts a key or secret as `string` (token text parse/format excepted).
- [ ] `zeroClearStrings` is deleted. No doc claims strings are wiped.
- [ ] `apikey.key` = `sha256(bearer)`. Nothing server-side stores the etk.
- [ ] `metadata.aet` never appears in list or public PAT responses.
- [ ] The CLI never sends the unlock part in `Authorization`, and never writes it to `~/.kylrix`.
- [ ] No AET accepted from a query string or body. Header only.
- [ ] Enclave secrets live in a WeakMap, released in `withApiGuard`'s `finally`.
- [ ] Plaintext responses are `Cache-Control: no-store`.
- [ ] Logging audit done. `authorization`, `x-kylrix-agent-token`, and `x-kylrix-mek` are redacted wherever headers are logged.
- [ ] https enforced for AET use in the CLI and server (loopback exempt).
- [ ] VS Code: no `sendText`, no `environmentVariableCollection`, masked inputs.
- [ ] `sessionStorage` draft holds no secret fields.
- [ ] AES-GCM IVs are random per encryption (12 bytes for AET wraps). AAD = `resourceKey`.
- [ ] HKDF with a per-envelope 16-byte salt. No SHA-256-as-KDF.
- [ ] Error messages are generic and never include inputs.
- [ ] `grep -rn "kyl_apk_" --include=*.ts --include=*.tsx --include=*.md . | grep -v node_modules | grep -v dist` shows only provisioning-key usages.

---

## 12. Migration Guide

### 12.1 Who is affected

- **Agent Provisioning Keys (`kyl_apk_<prefix>_<secret>`):** nothing changes. They keep working with the same format, category, and behavior.
- **Pre-release AET strings (`kyl_apk_<id>.<etk>`):** no product path ever minted these (#301), so none exist in real use. Any such string, if hand-made from the PR #299 sketch, is rejected with: "This agent key uses an old preview format. Create a new agent key in Settings."
- **New AETs:** always `kyl_aet_…`.

### 12.2 Steps for users

1. Update the CLI once the new version is published (`kylrix update`).
2. In Settings → Developers, create a new token with "Agent key with access to private items" turned on.
3. Replace any old value of `KYLRIX_AGENT_KEY` that contains a `.` with the new key. Values without a `.` are provisioning keys and stay as they are.
4. Use `kylrix agents connect --claude-code`, `kylrix exec -- <cmd>`, or the `X-Kylrix-Agent-Token` header.

### 12.3 Backward compatibility and rollout order

| Combination | Result |
|---|---|
| New server + old CLI (≤ 1.0.20) using `kyl_apk_` | works (unchanged) |
| New server + old CLI with an AET in `--token` | auth works (the guard strips the unlock part), but the old CLI sends the unlock part to the server. Release notes say "update your CLI before using agent keys". |
| Old server + new CLI with an AET | 401 (prefix unknown). Deploy the server first. |

**Deploy order:** server (guard, PatService, endpoints) → web UI (minting) → CLI release (human runs publish) → VS Code extension.

**Rollback:** AET Rows are ordinary `apikey` Rows. Rolling back the server makes them fail auth (401). Nothing is corrupted, and revoking still works from the new UI after roll-forward. No data migration is needed in either direction.

### 12.4 Agent knowledge capture (required by `AGENTS.md`)

Append to `.agents/skills/security/SKILL.md`:

- Row wrapped-DEK format: base64(IV16 || GCM(MEK, utf8(base64(DEK)))), with the inner plaintext being base64 text.
- Where credential/TOTP wrapped DEKs physically live (the answer to the §2.5 precondition).
- AET = `kyl_aet_<8hex>_<32 b64url>.etk_<64hex>`. `apikey.key` hashes the bearer only.
- Why AAD = `resourceKey` (anti-swap).
- Header mode is server-assisted, not zero-knowledge. Never log headers.
- JS strings cannot be wiped. Only `Uint8Array` can.

---

## 13. Repository Constraints Recap

| Rule | Where it bites in this work |
|---|---|
| `pnpm` only | all commands |
| Table/Row terminology | comments, logs, docs in this work |
| Turso schema is the source of truth | no new columns; use `apikey.metadata`, `apikey.category` |
| No new Appwrite shim usage | new endpoints/services use Drizzle |
| Better Auth + Turso/libSQL only | no new auth providers |
| Global unmount policy, `keepMounted: false`, `disablePortal` | CreatePatDrawer, unlock UI reuse |
| Plain-language UI copy | §8.4 |
| No build/lint unless the user asks | run targeted vitest only |
| No dev servers or Playwright by the agent | §10.3 is user-run |
| CLI version bump + rebuild + tests on every CLI change | Phases 1, 2, 3, 5 |
| Strict scope | touch only the files listed per issue; ask before expanding |
| Commit + push after each phase; no co-author trailers | §3.2 |
| Capture learnings in `.agents/skills/` | §12.4 |

---

## 14. Open Questions for the Implementer to Resolve (and record)

These need a look at running code or data, not a design decision. Resolve each one, note the answer in `.agents/skills/security/SKILL.md`, and proceed. Escalate to the user only if the answer blocks the design.

1. **Physical location of credential/TOTP wrapped DEKs** (§2.5). `row.dek` versus `metadata.dek` versus none.
2. **Notes ciphertext format.** Does it match `encryptFieldWithKey`? If not, ship without notes (§4 #301).
3. **`shapeVaultItem` output.** Does it already expose ciphertext without a MEK? If so, `?sealed=1` may reuse it, but it must still return 403 for non-AET actors.
4. **Header logging.** Which loggers, if any, dump request headers (§4 #307 audit)?
