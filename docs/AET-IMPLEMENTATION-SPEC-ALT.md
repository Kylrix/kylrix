# AET Implementation Spec: Agent Enclave Tokens (Issues #300 to #319)

> Alternative spec, written in parallel with [AET-IMPLEMENTATION-SPEC.md](./AET-IMPLEMENTATION-SPEC.md). Both cover issues #300 to #319. Reconcile them before implementation starts.

| Field | Value |
|---|---|
| Status | Proposed |
| Scope | Fix the 20 review findings on PR #299 (issues #300 to #319, `Kylrix/kylrix`) |
| Owners | Web app (`kylrix/`), CLI (`packages/cli`), VS Code (`packages/vscode`) |
| Token format | `kyl_aet_<tokenId>.<etkSecret>` (version 1) |
| Supersedes | The `kyl_apk_<tokenId>.<etkSecret>` format introduced in PR #299 |

---

## 1. Executive Summary

### 1.1 What an AET is

An **Agent Enclave Token (AET)** is a key a user gives to an AI agent (Claude Code, Cursor, a CI job, a script). It lets the agent read specific encrypted items (vault logins, 2FA secrets, locked notes) **without the Kylrix server ever being able to read them**.

The token has two halves:

```
kyl_aet_<tokenId>.<etkSecret>
        └─access─┘ └─unlock─┘
```

- **Access part** (`kyl_aet_<tokenId>`): a normal server-checked credential, hashed in the `apikey` Table like any PAT. It proves *who* is asking.
- **Unlock part** (`<etkSecret>`): 32 random bytes that only the browser that minted the token and the agent holding it ever see. It unlocks the row keys (DEKs) the user chose to share.

When minting, the browser (already unlocked with the user's master key, MEK) re-wraps each chosen Row's DEK with a key derived from `etkSecret`, and uploads only those wrapped DEKs. The server stores ciphertext it cannot open.

### 1.2 Why this spec exists

PR #299 shipped the crypto primitives and UI scaffolding, but review found that:

- The token prefix collides with Agent Provisioning Keys (`kyl_apk_`) (#300).
- No part of the flow is wired end to end: the UI mints a plain PAT (#301, #317), the CLI command is unregistered and a stub (#302, #303), the REST header and `exec --token` do not exist (#307, #308).
- Secrets leak or are not really cleared (#304, #305, #318).
- The crypto module has input-handling and API-shape defects (#309, #310, #311, #313, #314).
- UX, tests, and docs are incomplete or inaccurate (#306, #312, #315, #316, #319).

### 1.3 Goals

1. One unambiguous token format that cannot be confused with any PAT type.
2. A working mint flow in Settings that wraps real Row DEKs for the resources the user picked.
3. Two consumption paths:
   - **Private mode (default):** CLI, VS Code, and local MCP fetch sealed Rows and decrypt locally. The server never receives `etkSecret`.
   - **Server unlock mode (opt-in per token):** thin clients (curl) send the full token in `X-Kylrix-Agent-Token`. The server unlocks in request memory only. The UI labels this as a weaker option.
4. Secrets handled as `Uint8Array` and zero-filled. Docs are honest about where JavaScript strings cannot be cleared.
5. Test coverage on `lib/security/zero-knowledge.ts` above 90% of lines, plus shared test vectors so the web and CLI implementations agree byte for byte.

### 1.4 Non-goals (v1)

- AETs are **read-only**. Writing encrypted Rows needs the MEK to seal new Row DEKs, and an agent does not hold the MEK. Writes stay on PATs plus `X-Kylrix-MEK` or agentic workspaces.
- Rows created **after** minting are not covered automatically (see §3.7, "Refresh access").
- No new Turso Table in v1. Wrapped DEKs live in `apikey.metadata` (§3.5), with a Row cap.

---

## 2. Current State (as of commit `204b473f`)

| Area | File | State |
|---|---|---|
| Crypto | `lib/security/zero-knowledge.ts` | Primitives exist. SHA-256 "KDF" over a string secret, DEKs re-hashed before use (incompatible with vault Row DEKs), no input validation, `zeroClearStrings` is a no-op. |
| PAT service | `lib/services/pats.ts` | `kyl_apk_` = Agent Provisioning Key. `parsePatToken` splits on the first `_`. |
| API guard | `lib/api/guard.ts` | Only `Authorization: Bearer`. `kyl_apk_` routed to `PatService.verifyBearer`. |
| Vault Row crypto | `lib/api/vault-crypto.ts` | Rows carry a `dek` column = `base64(iv16 ‖ AES-GCM(MEK, base64(DEK)))`. Fields = `base64(iv16 ‖ AES-GCM(DEK, utf8(value)))`. Fallback: some Rows are encrypted directly with the MEK and have no `dek`. |
| UI | `components/settings/CreatePatDrawer.tsx` | AET toggle and two wizard steps collect state. `handleCreate` ignores it and mints a standard PAT. Header blank on wizard steps. |
| CLI | `packages/cli/src/commands/agents.ts`, `exec.ts`, `index.ts` | `connectAgentCommand` is unregistered and prints fake success. `exec` has no `--token`. CLI version `1.0.20`. |
| VS Code | `packages/vscode/src/extension.ts` | `injectTerminalSecrets` types the token into the terminal (`sendText`). `copyAgentKey` copies any input. |
| Docs | `README.md` §"Zero-Knowledge Secrets", `docs/security-and-vault.md` §"Dual-Wrapped Enclave Crypto" | Describe the full flow as shipped. |

Key fact for the design: **Row DEKs already exist** for Rows created through the API (`sealRowFields`). An AET re-wraps those same raw DEKs, so it needs no change to how Rows are stored. The only Rows needing work are older MEK-only Rows (§3.6).

---

## 3. Architecture

### 3.1 Token format v1

```
kyl_aet_<prefix>_<authSecret>.etk_<etkHex>
        └──────── tokenId ───────┘ └ etkSecret ┘
```

| Part | Alphabet / length | Generated by | Stored on server | Purpose |
|---|---|---|---|---|
| `kyl_aet_` | literal | n/a | n/a | Type tag. Never shared with any PAT type. |
| `prefix` | `[a-z2-7]{10}` (base32 lowercase, 50 bits) | Browser at mint | Yes, `apikey.prefix` / `apikey.start` | Public lookup id, HKDF salt, AAD binding. Has no `_`, so splitting is unambiguous. |
| `authSecret` | `[A-Za-z0-9_-]{43}` (32 bytes base64url) | Server at mint | Hash only: `apikey.key = sha256("kyl_aet_" + prefix + "_" + authSecret)` | Proves the caller holds the token. |
| `etkSecret` | `etk_` + `[a-f0-9]{64}` (32 bytes) | Browser at mint | **Never** in private mode | Derives the wrapping key for Row DEKs. |

Canonical grammar (single source of truth, exported from `zero-knowledge.ts`):

```ts
export const AET_TYPE_TAG = 'kyl_aet_';
export const AET_TOKEN_RE =
  /^kyl_aet_([a-z2-7]{10})_([A-Za-z0-9_-]{43})\.etk_([a-f0-9]{64})$/;
export const AET_ACCESS_RE = /^kyl_aet_([a-z2-7]{10})_([A-Za-z0-9_-]{43})$/;
```

Names used throughout this spec:

- **Full token**: the whole string. Shown once in the UI.
- **Access token**: `kyl_aet_<prefix>_<authSecret>` (everything before the `.`). Safe to send as `Authorization: Bearer`.
- **Unlock bytes**: the 32 bytes decoded from `etkHex`. Always held as `Uint8Array`.

> Why `tokenId` contains a secret: in the PR #299 format, the server could only authenticate the token by seeing `etkSecret` or by trusting a bare id. Making `tokenId` a hashed credential lets the server authenticate the access part while never needing the unlock part.

### 3.2 Key derivation (replaces SHA-256, fixes #314)

```
wrapKey = HKDF-SHA256(
  ikm  = unlockBytes                       // 32 random bytes
  salt = utf8("kyl_aet_" + prefix)         // binds key to this token
  info = utf8("kylrix/aet/v1/dek-wrap")    // domain separation
) -> AES-GCM-256, non-extractable, usages: encrypt, decrypt
```

HKDF is correct here because the input is already high-entropy random bytes, so no stretching is needed. The function **rejects** anything that is not exactly 32 bytes, which makes misuse with a password impossible.

### 3.3 Wrapped DEK entry v1

```ts
export type AetResourceKind = 'credential' | 'totp' | 'note';

export interface WrappedDekEntryV1 {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'HKDF-SHA256';
  iv: string;          // base64, exactly 12 bytes
  wrappedDek: string;  // base64, exactly 48 bytes (32-byte DEK + 16-byte tag)
}

/** Keyed by `${kind}:${rowId}`, e.g. "credential:01J9...". */
export type WrappedDekMapV1 = Record<`${AetResourceKind}:${string}`, WrappedDekEntryV1>;
```

Each entry is encrypted with **additional authenticated data (AAD)**:

```
aad = utf8(`kylrix/aet/v1|${prefix}|${kind}|${rowId}`)
```

This stops an attacker with database write access from moving an entry onto a different Row or token. Decryption fails if the entry is swapped.

Map keys use logical kinds (`credential`, `totp`, `note`, matching `workspace_objects.entityKind`), not physical Table names. That way the format survives the ongoing move off the legacy `systemTables()` layer.

### 3.4 Mint flow (browser)

```mermaid
sequenceDiagram
  participant U as User (Settings)
  participant B as Browser
  participant S as Server (server action)
  U->>B: Pick resources, expiry, server unlock on/off
  B->>B: Require unlocked vault (masterPassCrypto.getMasterKey())
  B->>B: prefix = random base32(10); unlockBytes = random(32)
  B->>S: listAetEligibleRows(resources, workspaceId)
  S-->>B: [{kind,id,dek,hasDek}]  (ciphertext only)
  loop each eligible Row
    B->>B: dek = AES-GCM-decrypt(MEK, row.dek) (raw 32 bytes)
    B->>B: entry = AES-GCM(wrapKey, dek, aad)
    B->>B: dek.fill(0)
  end
  B->>S: createAetSecure({name, prefix, resources, expiresAt, allowServerUnseal, wrappedDeks})
  S->>S: validate ownership + shape, create apikey Row (category agent_enclave_token)
  S-->>B: { pat, accessToken }
  B->>U: Show full token = accessToken + "." + "etk_" + hex(unlockBytes)
  B->>B: unlockBytes.fill(0) when drawer closes
```

One server round trip creates the token. The browser picks `prefix` so it can bind HKDF salt and AAD before upload. The server rejects a prefix that already exists (HTTP 409, browser retries with a new prefix; collision odds are about 1 in 10^15).

### 3.5 Server-side storage

No new Table and no new column. `apikey` already has `metadata TEXT` and `category TEXT` (`turso-schema.sql` lines 100 to 126).

```json
{
  "agentId": null,
  "aet": {
    "v": 1,
    "resources": { "vault": true, "totp": true, "notes": false },
    "allowServerUnseal": false,
    "rowCount": 14,
    "mintedAt": "2026-10-28T12:00:00.000Z",
    "wrappedDeks": {
      "credential:01J9ZK...": { "v": 1, "alg": "AES-256-GCM", "kdf": "HKDF-SHA256", "iv": "…", "wrappedDek": "…" }
    }
  }
}
```

- `category = 'agent_enclave_token'` (new `PatCategory` member). Before merging, check `turso-schema.sql` for a CHECK constraint on `category`. If one exists, update `turso-schema.sql` first (it is the single source of truth).
- **Row cap:** 1,000 entries per token (about 120 bytes each, so about 120 KB). Above the cap, minting fails with plain copy: "This key can cover up to 1,000 items. Pick fewer item types or use a workspace."
- **Revoke = shred:** `PatService.revoke` sets `enabled = false` **and** deletes `metadata.aet.wrappedDeks` for AET Rows. A re-enabled Row can then never unlock anything.
- **Workspace mode:** when the drawer runs with `isWorkspace`/`workspaceId`, only Rows linked to that workspace (`workspace_objects`) are eligible. The PAT Row is stamped and joined exactly as `PatService.create` already does for workspace PATs.

### 3.6 Rows without a DEK (older MEK-only Rows)

Some Rows were encrypted directly with the MEK (the "Tier 2" fallback in `docs/security-and-vault.md` §3) and have an empty `dek`. They cannot be shared without exposing the MEK. At mint the browser offers a one-time upgrade:

1. Decrypt each field with the MEK.
2. Generate a fresh 32-byte DEK and re-encrypt the fields in the `vault-crypto` field format (`iv16 ‖ ct`).
3. Wrap the DEK with the MEK (`dek` column format).
4. **Verify the round trip in memory** (decrypt the new fields with the new DEK and compare).
5. Only then write `{fields, dek}` to the Row in a single update.

If any step fails for a Row, that Row is skipped and listed in the result ("2 items could not be added"). The Row is never left half-written. The upgrade is shown to the user before it runs:

> "3 older items need a quick update before an agent can read them. Your data stays private. Update and continue?"

**Phase 2, task 0 (research):** confirm the on-disk formats for TOTP and locked notes (`ideas`) before coding. Credentials are confirmed (`sealRowFields`). If notes use `masterPassCrypto.encryptData` (JSON-wrapped, MEK-only), they always go through this upgrade path.

### 3.7 Refresh access (stale coverage)

Rows created after minting have no entry. Rows whose DEK was regenerated (the `catch` branch in `sealRowFields`) get a stale entry. The bundle endpoint reports both:

```json
{ "rows": [...], "missing": 0, "stale": ["credential:01J..."] }
```

v1 ships the reporting only. A "Refresh access" action (browser re-wraps with the same unlock bytes, which the user pastes back in) is planned as a follow-up and is out of scope for #300 to #319.

### 3.8 Consumption modes

| Mode | Transport | Who decrypts | Server sees unlock bytes? | Default |
|---|---|---|---|---|
| Private | `Authorization: Bearer kyl_aet_<tokenId>` then `GET /api/v1/aet/bundle` | Client (CLI, VS Code, local MCP) | **No** | On |
| Server unlock | `X-Kylrix-Agent-Token: <full token>` on normal resource routes | Server, in request memory | Yes, for one request | Off; per-token opt-in |

If a client puts the **full token** in `Authorization: Bearer`, the guard uses only the access part and zero-fills the decoded unlock bytes immediately. The response then carries `X-Kylrix-Warning: aet-unlock-part-ignored`.

---

## 4. Phased Implementation Plan

Each phase is one PR against `master`. Phases 2 and 4 touch the same file. **Phase 2 must not merge before #311 and #313 from Phase 4**, because the mint flow needs raw-DEK helpers and entry validation. Land those two first or in the same PR.

| Phase | Issues | Theme | Depends on |
|---|---|---|---|
| 1 | #300, #304, #305 | Stop the bleeding: format, terminal leak, fake clearing | n/a |
| 2 | #301, #302, #303 | End-to-end mint and CLI connect | 1, plus #311 and #313 |
| 3 | #307, #308 | REST header and `exec --token` | 2 |
| 4 | #309, #310, #311, #313, #314 | Crypto hardening | 1 |
| 5 | #306, #312, #315, #316, #317, #318 | UX polish and tests | 2, 4 |
| 6 | #319 | Docs | 3, 5 |

Per-phase release rules (from `AGENTS.md`):

- Use `pnpm` only.
- Any change under `packages/cli/` bumps the patch version in **both** `packages/cli/package.json` and `packages/cli/src/updater/index.ts` (`CURRENT_VERSION`), rebuilds with `pnpm --filter @kylrix/cli build`, and runs CLI tests. Publishing is done by the human owner.
- `packages/cli` and `packages/vscode` stay out of root lint/tsconfig.

---

## 5. Per-Issue Specifications

### Phase 1: Critical security

#### #300: Token format collision (`kyl_apk_` used by PAT and AET)

**Problem.** `formatAgentToken` emits `kyl_apk_<id>.<etk>`, the same prefix as Agent Provisioning Keys (`formatPatToken(..., 'agent_provisioning_key')`). `parsePatToken` mis-parses AETs, and every `startsWith('kyl_apk_')` check (`guard.ts:68`, `cli/commands/auth.ts:45`) cannot tell the two apart.

**Files.**
- `lib/security/zero-knowledge.ts`: new constants, `formatAgentToken`, `parseAgentToken`.
- `lib/services/pats.ts`: add `'agent_enclave_token'` to `PatCategory`; `parsePatToken` rejects any string containing `.` or starting with `kyl_aet_`; new `parseAetAccessToken` and `verifyAetAccess`.
- `lib/api/guard.ts`: route `kyl_aet_` to the AET path (§7). Detect legacy `kyl_apk_*.*`.
- `packages/cli/src/commands/auth.ts`: label `kyl_aet_` as "Private Agent Key".
- `packages/vscode/src/extension.ts`: placeholders and prompts.

**Solution.**

```ts
// lib/security/zero-knowledge.ts
export type AetParseFailure = 'empty' | 'legacy_format' | 'wrong_type' | 'malformed';

export interface ParsedAgentToken {
  prefix: string;
  /** `kyl_aet_<prefix>_<authSecret>`. Safe to send as Bearer. */
  accessToken: string;
  /** 32 bytes. Caller MUST zero-fill when done. */
  unlockBytes: Uint8Array;
}

export function parseAgentToken(
  input: unknown,
): { ok: true; token: ParsedAgentToken } | { ok: false; reason: AetParseFailure } {
  if (typeof input !== 'string' || input.trim() === '') return { ok: false, reason: 'empty' };
  const s = input.trim();
  if (s.startsWith('kyl_apk_') && s.includes('.')) return { ok: false, reason: 'legacy_format' };
  if (!s.startsWith(AET_TYPE_TAG)) return { ok: false, reason: 'wrong_type' };
  const m = AET_TOKEN_RE.exec(s);
  if (!m) return { ok: false, reason: 'malformed' };
  return {
    ok: true,
    token: {
      prefix: m[1],
      accessToken: `${AET_TYPE_TAG}${m[1]}_${m[2]}`,
      unlockBytes: hexToBytes(m[3]),
    },
  };
}

export function formatAgentToken(accessToken: string, unlockBytes: Uint8Array): string {
  if (!AET_ACCESS_RE.test(accessToken)) throw new AetError('malformed', 'Invalid access part');
  if (unlockBytes.byteLength !== 32) throw new AetError('malformed', 'Unlock part must be 32 bytes');
  return `${accessToken}.etk_${bytesToHex(unlockBytes)}`;
}
```

```ts
// lib/services/pats.ts
export function parsePatToken(raw: string) {
  const token = String(raw || '').trim();
  if (token.includes('.') || token.startsWith('kyl_aet_')) return null;
  // ...existing logic unchanged...
}
```

**Migration.** No AET was ever issued in the old format: `handleCreate` always minted a plain PAT (#301), so no `kyl_apk_*.etk_*` string exists in any database. Migration is therefore **reject with a clear message**, not convert:

| Input | Web/API | CLI / VS Code message |
|---|---|---|
| `kyl_apk_<id>.<etk>` | 401 `{ code: 'legacy_aet_format' }` | "This key uses an old format that never worked. Create a new private agent key in Settings > Developers." |
| `kyl_apk_<prefix>_<secret>` | Unchanged (Agent Provisioning Key) | Unchanged |

Other `kyl_apk_` references (`lib/actions/sidekick.ts`, `components/overlays/LoginDrawer.tsx`, `components/settings/AgenticSettingsDrawer.tsx`, `components/settings/DevelopersTab.tsx`) are about provisioning keys. Audit them, but do not change them.

**Tests.** `parseAgentToken` accepts a valid v1 token; returns `legacy_format` for `kyl_apk_tok_1.etk_…`; `wrong_type` for `kyl_pat_…`; `malformed` for wrong lengths, uppercase hex, extra dots, or `_` in the prefix. `parsePatToken` returns `null` for any `kyl_aet_` string and any string with `.`. Existing `pats.test.ts` cases still pass.

**Acceptance.** No code path accepts `kyl_apk_*.*`. `grep -r "kyl_apk_" lib/security packages/vscode` returns nothing. PAT and AET parsers are mutually exclusive on every fixture.

#### #304: VS Code `injectTerminalSecrets` leaks to scrollback

**Problem.** `terminal.sendText('export KYLRIX_AGENT_KEY="…"')` puts the token in scrollback and shell history.

**Files.** `packages/vscode/src/extension.ts`, plus a new `packages/vscode/src/aet.ts` (validation shared with #315).

**Solution.** Never type secrets. Create a **new** terminal with the variable set through the API. An existing terminal's environment cannot be changed safely, so the command always opens a new one.

```ts
vscode.commands.registerCommand('kylrix.injectTerminalSecrets', async () => {
  const token = await promptForAgentKey('Paste your private agent key');
  if (!token) return;
  const terminal = vscode.window.createTerminal({
    name: 'Kylrix Agent',
    env: { KYLRIX_AGENT_KEY: token },
    isTransient: true,   // not restored on reload, so env is not persisted
  });
  terminal.show();
  vscode.window.showInformationMessage('Opened a terminal with your agent key. It is not saved anywhere.');
});
```

`promptForAgentKey` uses `showInputBox({ password: true, ignoreFocusOut: true, validateInput })` (see #315).

**Tests.** Unit-test `promptForAgentKey`'s validator (pure function). Manual check: the new terminal shows nothing in scrollback, `history | grep KYLRIX` is empty, `echo ${#KYLRIX_AGENT_KEY}` prints the expected length.

**Acceptance.** No call to `sendText` anywhere receives token material (enforce with a grep check in the extension's test script).

#### #305: `zeroClearStrings` is a no-op

**Problem.** Strings are immutable, so reassigning array slots clears nothing.

**Files.** `lib/security/zero-knowledge.ts`, `lib/security/zero-knowledge.test.ts`, `packages/cli/src/commands/agents.ts`.

**Solution.**
1. **Delete** `zeroClearStrings` and its export on `ZeroKnowledgeModule`. Its only caller is the test. `AGENTS.md` favors deleting dead, misleading code.
2. All secret material crosses module boundaries as `Uint8Array`: `parseAgentToken` returns `unlockBytes`; DEKs are `Uint8Array`; wrapping keys are non-extractable `CryptoKey`s.
3. Add a scoped helper so clearing cannot be forgotten:

```ts
/** Runs fn with secret bytes, then zero-fills them even if fn throws. */
export async function withSecretBytes<T>(
  bytes: Uint8Array,
  fn: (b: Uint8Array) => Promise<T>,
): Promise<T> {
  try {
    return await fn(bytes);
  } finally {
    bytes.fill(0);
  }
}
```

4. Add a module doc note: "Decrypted values that must become strings (HTTP bodies, env vars) cannot be wiped in JavaScript. Keep them in as small a scope as possible and never log them."

**Tests.** `withSecretBytes` zero-fills on success and on throw. A type-level test (`// @ts-expect-error`) confirms `zeroClearStrings` is gone.

**Acceptance.** No exported API claims to clear strings. `rg zeroClearStrings` is empty outside the git history.

### Phase 2: Core AET functionality

#### #301: AET generation not implemented in `CreatePatDrawer`

**Problem.** Wizard state is collected but `handleCreate` mints a normal PAT.

**Files.**
- `components/settings/CreatePatDrawer.tsx`: branch `handleCreate`.
- New `lib/security/aet-mint.ts` (client-only): `buildAetMint()`; pure and unit-tested.
- `lib/actions/secure-ops/pats.ts`: add `listAetEligibleRowsSecure` and `createAetSecure`.
- `lib/actions/client-ops.ts`: add `listAetEligibleRows` and `createAet` wrappers (same JWT pattern as `createPat`).
- `lib/services/pats.ts`: add `PatService.createAet`.

**Solution (client).**

```ts
// lib/security/aet-mint.ts
export interface AetMintInput {
  resources: AetResources;          // { vault, totp, notes }
  mekKey: CryptoKey;                // masterPassCrypto.getMasterKey()
  rows: EligibleRow[];              // { kind, id, dek: string | null }
}

export async function buildAetMint(input: AetMintInput) {
  const prefix = randomBase32(10);
  const unlockBytes = crypto.getRandomValues(new Uint8Array(32));
  const wrapKey = await ZeroKnowledgeModule.deriveAetWrappingKey(unlockBytes, prefix);
  const wrappedDeks: WrappedDekMapV1 = {};
  const skipped: string[] = [];
  const needsUpgrade: EligibleRow[] = [];

  for (const row of input.rows) {
    if (!row.dek) { needsUpgrade.push(row); continue; }
    try {
      const dek = await ZeroKnowledgeModule.unwrapRowDekWithMek(row.dek, input.mekKey);
      try {
        wrappedDeks[`${row.kind}:${row.id}`] =
          await ZeroKnowledgeModule.wrapDekForAet(dek, wrapKey, { prefix, kind: row.kind, rowId: row.id });
      } finally {
        dek.fill(0);
      }
    } catch {
      skipped.push(`${row.kind}:${row.id}`);
    }
  }
  return { prefix, unlockBytes, wrappedDeks, skipped, needsUpgrade };
}
```

`handleCreate`:

```ts
const handleCreate = async () => {
  if (!isAetToken) return createStandardPat();          // existing body, unchanged

  const mekKey = masterPassCrypto.getMasterKey();
  if (!mekKey) { setStep('unlock_required'); return; }  // opens the existing unlock flow

  setCreating(true);
  let mint: Awaited<ReturnType<typeof buildAetMint>> | null = null;
  try {
    const rows = await listAetEligibleRows({ resources, workspaceId: isWorkspace ? workspaceId : null });
    mint = await buildAetMint({ resources, mekKey, rows });
    if (mint.needsUpgrade.length && !(await confirmUpgrade(mint.needsUpgrade.length))) return;
    // ...run §3.6 upgrade for needsUpgrade, add their entries...
    const res = await createAet({
      name: name.trim(),
      prefix: mint.prefix,
      resources,
      expiresAt: aetExpiryDays > 0 ? addDays(new Date(), aetExpiryDays).toISOString() : null,
      allowServerUnseal,
      wrappedDeks: mint.wrappedDeks,
      isWorkspace,
      workspaceId,
    });
    setToken(ZeroKnowledgeModule.formatAgentToken(res.accessToken, mint.unlockBytes));
    setSkippedCount(mint.skipped.length);
    setStep('done');
    onCreated?.();
  } catch (err: any) {
    toast.error(friendlyAetError(err));
  } finally {
    mint?.unlockBytes.fill(0);
    setCreating(false);
  }
};
```

The full token exists as a React string only while the `done` step is mounted. The drawer is conditionally rendered (`if (!open) return null` and `keepMounted={false}`), so closing it drops the reference. Do **not** auto-copy AETs to the clipboard. Copying is an explicit button, and the clipboard is cleared after 60 seconds if it still holds the token.

**Solution (server).**

```ts
// lib/services/pats.ts
async createAet(params: {
  userId: string; name: string; prefix: string; resources: AetResources;
  expiresAt: string | null; allowServerUnseal: boolean;
  wrappedDeks: unknown; isWorkspace?: boolean; workspaceId?: string | null;
}): Promise<{ pat: PatPublic; accessToken: string }> {
  if (!/^[a-z2-7]{10}$/.test(params.prefix)) throw httpError(400, 'Invalid key id');
  const map = validateWrappedDekMap(params.wrappedDeks, params.resources); // shape + kinds + cap 1000
  await assertRowsOwned(params.userId, Object.keys(map), params.workspaceId); // every kind:id belongs to user (and workspace)
  if (await prefixExists(params.prefix)) throw httpError(409, 'Key id already used');

  const authSecret = randomBytes(32).toString('base64url');
  const accessToken = `kyl_aet_${params.prefix}_${authSecret}`;
  // insert apikey Row: category 'agent_enclave_token', key = sha256(accessToken),
  // permissions = deriveAetScopes(params.resources) (see #317),
  // metadata = { agentId: null, aet: { v:1, resources, allowServerUnseal, rowCount, mintedAt, wrappedDeks: map } }
  // workspace stamping + workspace_objects join exactly as create()
  return { pat: toPublic(row), accessToken };
}
```

`createAetSecure` resolves the actor from the JWT. It only accepts session actors (`kind: 'session'`), so an AET or PAT cannot mint AETs.

**Tests.**
- `buildAetMint` with three rows (one with DEK, one without, one corrupt) gives 1 entry, 1 `needsUpgrade`, 1 `skipped`.
- Each entry unwraps with the derived key and the correct AAD, and fails with a different `rowId` in the AAD.
- `createAet` rejects a bad prefix, a duplicate prefix (409), a foreign row id (403), more than 1,000 entries (400), and a `note:` key when `resources.notes = false`.
- The stored Row has the right category, hashed key, and derived scopes, and `metadata` never contains plaintext.

**Acceptance.** With the AET toggle on, the done screen shows a token matching `AET_TOKEN_RE`. `GET /api/v1/aet/bundle` with its access part returns Rows that the CLI can decrypt.

#### #302: `connectAgentCommand` never registered

**Files.** `packages/cli/src/index.ts`.

**Solution.**

```ts
import {
  listAgentSessionsCommand, getAgentSessionCommand, startAgentSessionCommand,
  deleteAgentSessionCommand, connectAgentCommand,
} from './commands/agents';

agents
  .command('connect')
  .description('Give an AI tool private access to the items your agent key covers')
  .option('--agent-token <token>', 'Private agent key (kyl_aet_...). Defaults to $KYLRIX_AGENT_KEY')
  .option('--claude-code', 'Launch Claude Code with access')
  .option('--cursor', 'Launch Cursor agent with access')
  .option('--check', 'Only check the key and show what it can open')
  .allowUnknownOption()
  .action((cmdOpts) => connectAgentCommand({ ...program.opts(), ...cmdOpts, passthrough: argsAfterDashDash('connect') }));
```

`--agent-token` is used instead of `--token` because `--token` is already a global option (the PAT used by `requireAuthClient`, merged through `program.opts()`). Reusing the name would silently override it.

**Tests.** `kylrix agents --help` lists `connect`. The commander parse test maps `--agent-token`, `--claude-code`, and `--check` correctly and does not clobber the global `--token`.

**Acceptance.** `kylrix agents connect --check` runs the real implementation from #303.

#### #303: `connectAgentCommand` is a stub

**Files.**
- `packages/cli/src/commands/agents.ts`: rewrite `connectAgentCommand`.
- New `packages/cli/src/aet/session.ts`: `openAetSession()` (parse, fetch bundle, decrypt) shared with `exec --token` (#308).
- `packages/cli/src/client`: add `client.aet.self()` and `client.aet.bundle(resources?)`.

**Crypto source.** The CLI imports `lib/security/zero-knowledge.ts` by relative path, and `tsup` bundles it. The module has no dependencies and uses only WebCrypto (`globalThis.crypto`, Node 18 and later). That keeps one implementation. `packages/cli/tsconfig.json` gets an explicit `include` for that one file. The root `tsconfig`/eslint exclusions stay as they are. If the bundle boundary is rejected in review, the fallback is a vendored copy plus the shared vector file (§11.2). Divergence is then caught by tests.

**Solution.**

```ts
// packages/cli/src/aet/session.ts
export interface AetSession {
  self: AetSelf;                                  // resources, expiry, counts
  items: DecryptedItem[];                         // { kind, id, title, fields: Record<string,string> }
  stale: string[];
  close(): void;                                  // zero-fills every byte buffer it owns
}

export async function openAetSession(rawToken: string, opts: { url?: string; resources?: AetResourceKind[] }) {
  const parsed = parseAgentToken(rawToken);
  if (!parsed.ok) throw new CliError(aetParseMessage(parsed.reason));
  const { accessToken, prefix, unlockBytes } = parsed.token;
  const owned: Uint8Array[] = [unlockBytes];
  try {
    const client = getClient({ url: opts.url, token: accessToken });   // access part only
    const [self, bundle] = await Promise.all([client.aet.self(), client.aet.bundle(opts.resources)]);
    const wrapKey = await ZeroKnowledgeModule.deriveAetWrappingKey(unlockBytes, prefix);
    unlockBytes.fill(0);
    const items: DecryptedItem[] = [];
    for (const row of bundle.rows) {
      const dek = await ZeroKnowledgeModule.unwrapDekForAet(row.entry, wrapKey, { prefix, kind: row.kind, rowId: row.id });
      owned.push(dek);
      items.push({ kind: row.kind, id: row.id, title: row.title, fields: await decryptFields(dek, row.fields) });
      dek.fill(0);
    }
    return { self, items, stale: bundle.stale, close: () => owned.forEach((b) => b.fill(0)) };
  } catch (e) {
    owned.forEach((b) => b.fill(0));
    throw e;
  }
}
```

`connectAgentCommand`:

1. Resolve the token: `--agent-token`, then `$KYLRIX_AGENT_KEY`, then a hidden interactive prompt (`@clack/prompts` `password`). Never read `$KYLRIX_TOKEN` as an AET.
2. `openAetSession()` (this proves the token works end to end).
3. Print a summary with **no secret values**: key name, expiry, "Can open: 12 logins, 3 2FA codes", stale count.
4. `--check`: stop here, `session.close()`, exit 0.
5. `--claude-code` / `--cursor` / passthrough command: spawn the tool as a child with `stdio: 'inherit'` and `env = { ...process.env, KYLRIX_AGENT_KEY: rawToken }`. The tool's own `kylrix mcp` server (already shipped) can then open items on demand. For Claude Code, pass the MCP server inline with `--mcp-config '<json>'` so nothing is written to disk. Verify the flag against the installed Claude Code version and fall back to printing setup instructions.
6. On child exit or signal (`SIGINT`, `SIGTERM`): `session.close()`, then mirror the exit code. One `finally` block, no redundant clears (see #318).

**Tests** (vitest, mocked client).
- Bad token gives the right message per `AetParseFailure` and exit code 1.
- A valid token makes the client get `Bearer kyl_aet_…` **without** `.etk_`. Assert on the header the mock received.
- Decrypt round trip against the shared vectors.
- `close()` zero-fills every buffer (spy on `fill`).
- On child exit, `close` is called exactly once.

**Acceptance.** `kylrix agents connect --check` on a real token prints correct counts. With a revoked token it fails with "This key was turned off." No success message prints unless decryption succeeded.

### Phase 3: API and CLI integration

#### #307: `X-Kylrix-Agent-Token` header not implemented

**Files.**
- `lib/api/guard.ts`: AET detection, `ApiActor.kind = 'aet'`, unlock context, cleanup.
- `lib/services/pats.ts`: `verifyAetAccess(accessToken)`.
- `lib/api/resources.ts`: `getAetSelf`, `getAetBundle`; vault, TOTP, and note read handlers learn the AET unlock path.
- `app/api/v1/[...path]/route.ts`: route `aet/self` and `aet/bundle`.
- Dev log ring buffer (`/api/dev/logs` hook): redact `x-kylrix-agent-token` and `authorization`.

Full behavior in §7. Core guard change:

```ts
export type ApiActor = {
  // ...existing fields...
  kind: 'pat' | 'oauth' | 'session' | 'aet';
  aet?: {
    prefix: string;
    resources: AetResources;
    allowServerUnseal: boolean;
    /** Present only for X-Kylrix-Agent-Token requests on tokens with allowServerUnseal. */
    unlock?: { wrapKey: CryptoKey };
  };
};
```

```ts
// inside withApiGuard
let actor: ApiActor | null = null;
try {
  actor = await resolveApiActor(req);
  const res = await handler(actor);
  // ...rate limit headers...
  return res;
} catch (err) {
  return jsonErr(err);
} finally {
  if (actor?.aet?.unlock) actor.aet.unlock = undefined; // drop CryptoKey ref; raw bytes were zeroed at derive time
}
```

The raw unlock bytes are zero-filled right after `deriveAetWrappingKey`. Only a non-extractable `CryptoKey` lives for the rest of the request.

**Tests.** See §7.5 and §11.

**Acceptance.** The README curl example works against a token minted with server unlock on, and returns 403 `aet_server_unseal_disabled` for a token with it off.

#### #308: `kylrix exec --token` not supported

**Files.** `packages/cli/src/commands/exec.ts`, `packages/cli/src/index.ts`, `packages/cli/src/aet/session.ts` (reuse).

**CLI surface.**

```
kylrix exec --agent-token <aet> [--only vault,totp,notes] [--env-prefix KYLRIX_] [--include-seeds] -- <command...>
kylrix exec <idOrUrl> [--share-key <key>] -- <command...>        # unchanged
```

- `<idOrUrl>` becomes optional, and exactly one of `<idOrUrl>` or `--agent-token` is required. Commander signature: `exec [idOrUrl] [command...]`.
- `--agent-token` falls back to `$KYLRIX_AGENT_KEY` only when `<idOrUrl>` is absent.
- `--token` (global PAT) keeps its meaning. The README is updated to `--agent-token` in Phase 6.

**Env variable mapping.** Names are deterministic and documented:

| Kind | Variables |
|---|---|
| credential | `${P}VAULT_${SLUG}_USERNAME`, `${P}VAULT_${SLUG}_PASSWORD`, `${P}VAULT_${SLUG}_URL` (non-empty fields only) |
| totp | `${P}TOTP_${SLUG}` = current 6-digit code; `${P}TOTP_${SLUG}_SEED` only with `--include-seeds` |
| note | Off by default; `${P}NOTE_${SLUG}` with `--only notes` |

`SLUG` = uppercase title, non-alphanumerics collapsed to `_`, trimmed to 48 characters. On a collision, append `_` plus the first 6 characters of the Row id. `P` defaults to `KYLRIX_`. Print the variable **names** (never values) when `--verbose` is set.

**Clearing.** The child env necessarily holds strings. After the child exits: delete the keys from the env object, call `session.close()`, and exit with the child's code. Docs state plainly that env values cannot be wiped from memory. The process exits immediately after, which is the real protection.

**Tests.** Slug and collision rules; flag exclusivity (`idOrUrl` plus `--agent-token` gives a usage error); the child receives the expected names (spawn mocked); `close` is called on exit and on spawn error; `--include-seeds` is off by default.

**Acceptance.** `kylrix exec --agent-token "$AET" -- printenv | grep -c KYLRIX_VAULT_` matches the number of covered logins with a password.

### Phase 4: Crypto module hardening

#### #309: No error handling for malformed base64

**Solution.** One strict decoder used by every path. Errors never echo the input.

```ts
const B64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class AetError extends Error {
  constructor(public code: 'malformed' | 'unsupported' | 'unlock_failed' | 'legacy_format', message: string) {
    super(message);
  }
}

function base64ToBytes(b64: string, expectedLength?: number): Uint8Array {
  if (typeof b64 !== 'string' || !B64_RE.test(b64)) throw new AetError('malformed', 'Invalid encoded value');
  let out: Uint8Array;
  if (typeof Buffer !== 'undefined') {
    out = new Uint8Array(Buffer.from(b64, 'base64'));
  } else {
    const bin = atob(b64);   // safe: regex already guarantees valid input
    out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  }
  if (expectedLength !== undefined && out.byteLength !== expectedLength) {
    out.fill(0);
    throw new AetError('malformed', 'Invalid encoded value');
  }
  return out;
}
```

The regex enforces length mod 4 and padding, so Node and browser behave the same. No round-trip re-encode is needed.

**Tests.** Invalid characters, bad padding, length not a multiple of 4, empty string (valid, yields 0 bytes, then rejected by `expectedLength` where one applies), whitespace, and a wrong expected length. Run under both the Node path and a forced browser path (`vi.stubGlobal('Buffer', undefined)`).

**Acceptance.** No caller can receive a raw `DOMException` from decoding.

#### #310: `toArrayBuffer` breaks on SharedArrayBuffer views

**Solution.** Always copy into a fresh `ArrayBuffer`. Zero-fill copies of secrets after use.

```ts
function copyToArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return out;
}

async function withBufferCopy<T>(view: ArrayBufferView, fn: (b: ArrayBuffer) => Promise<T>): Promise<T> {
  const copy = copyToArrayBuffer(view);
  try { return await fn(copy); } finally { new Uint8Array(copy).fill(0); }
}
```

Every secret input to `crypto.subtle` (unlock bytes, DEKs, plaintext) goes through `withBufferCopy`. Non-secret inputs (IVs, AAD, ciphertext) may use `copyToArrayBuffer` directly.

**Tests.** A subarray view with a non-zero `byteOffset` round-trips. A `SharedArrayBuffer`-backed view (guarded by `typeof SharedArrayBuffer !== 'undefined'`) encrypts. Copies are zeroed after the call (spy on `Uint8Array.prototype.fill`).

**Acceptance.** No `as ArrayBuffer` casts remain in the module.

#### #311: Missing algorithm validation in `unwrapDekFromMap`

**Solution.** Validate every field of an entry before any crypto call. All unwrap failures share one message so error text cannot act as an oracle.

```ts
function assertEntryV1(e: unknown): asserts e is WrappedDekEntryV1 {
  const x = e as Partial<WrappedDekEntryV1> | null;
  if (!x || x.v !== 1) throw new AetError('unsupported', 'Unsupported key version');
  if (x.alg !== 'AES-256-GCM' || x.kdf !== 'HKDF-SHA256') throw new AetError('unsupported', 'Unsupported key type');
  if (typeof x.iv !== 'string' || typeof x.wrappedDek !== 'string') throw new AetError('malformed', 'Invalid key entry');
}

async unwrapDekForAet(entry: unknown, wrapKey: CryptoKey, ctx: AetAadContext): Promise<Uint8Array> {
  assertEntryV1(entry);
  const iv = base64ToBytes(entry.iv, 12);
  const ct = base64ToBytes(entry.wrappedDek, 48);
  try {
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: copyToArrayBuffer(iv), additionalData: aadFor(ctx), tagLength: 128 },
      wrapKey, copyToArrayBuffer(ct));
    return new Uint8Array(raw);
  } catch {
    throw new AetError('unlock_failed', 'Could not unlock this item');
  }
}
```

The server's `validateWrappedDekMap` (called in `createAet`) runs `assertEntryV1` plus the length checks on every entry before storing, so bad data never reaches the database.

**Tests.** A tampered `alg`, `kdf`, or `v` gives `unsupported`. A wrong IV length or wrong ciphertext length gives `malformed`. A flipped ciphertext bit, wrong key, or wrong AAD all give the same `unlock_failed` message.

**Acceptance.** The old `unwrapDekFromMap` / `createWrappedDekMap` (no AAD, SHA-256 key) are deleted. Only the v1 functions remain.

#### #313: Confusing `dekBytes: Uint8Array | string` parameter

**Problem.** Strings get hashed as secrets, and **Uint8Array DEKs also get SHA-256 hashed**. That means `encryptPayload` cannot read fields sealed by `lib/api/vault-crypto.ts`, which imports the DEK raw and uses a 16-byte IV prefix.

**Solution.** Replace `encryptPayload` / `decryptPayload` with explicit, typed functions that match the existing Row field format exactly:

```ts
/** DEK must be exactly 32 raw bytes. Never hashed. Format: base64(iv16 ‖ ciphertext+tag). */
async encryptRowField(dek: Uint8Array, plaintext: string): Promise<string>;
async decryptRowField(dek: Uint8Array, fieldB64: string): Promise<string>;

/** Row `dek` column: base64(iv16 ‖ AES-GCM(MEK, utf8(base64(DEK))))  (see vault-crypto.ts). */
async unwrapRowDekWithMek(wrappedDekB64: string, mekKey: CryptoKey): Promise<Uint8Array>;
async wrapRowDekWithMek(dek: Uint8Array, mekKey: CryptoKey): Promise<string>;
```

- All take `Uint8Array` only. Passing a string is a type error, and a runtime check throws `AetError('malformed')`.
- Each checks `dek.byteLength === 32`.
- The 16-byte IV matches `encryptFieldWithKey`. Document why it differs from the 12-byte IV used for AET entries: the field format is pre-existing and must stay compatible.

Delete `encryptPayload`, `decryptPayload`, and `EncryptedPayload` (no callers outside tests).

**Tests.** **Cross-compat:** a field sealed by `vault-crypto.sealRowFields` (Node) decrypts with `decryptRowField`, and the reverse also works. `unwrapRowDekWithMek` reads a `dek` written by `sealRowFields`. A 31-byte or 33-byte DEK is rejected.

**Acceptance.** The browser mint path, CLI, and server all decrypt the same Row with the same bytes.

#### #314: `deriveKeyFromSecret` has no KDF for low-entropy input

**Solution.** Delete `deriveKeyFromSecret`. Replace it with `deriveAetWrappingKey(unlockBytes: Uint8Array, prefix: string)` from §3.2. It is the only derivation in the module, it requires exactly 32 bytes, and it is documented as "for random keys only". Password-based derivation already lives in `lib/masterpass-crypto.ts` (Argon2id/PBKDF2) and must not be duplicated here.

```ts
async deriveAetWrappingKey(unlockBytes: Uint8Array, prefix: string): Promise<CryptoKey> {
  if (!(unlockBytes instanceof Uint8Array) || unlockBytes.byteLength !== 32) {
    throw new AetError('malformed', 'Unlock part must be 32 random bytes');
  }
  if (!/^[a-z2-7]{10}$/.test(prefix)) throw new AetError('malformed', 'Invalid key id');
  return withBufferCopy(unlockBytes, async (ikm) => {
    const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: utf8(`kyl_aet_${prefix}`), info: utf8('kylrix/aet/v1/dek-wrap') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return key;
  });
}
```

**Tests.** A known-answer test against a fixed vector (§11.2). Rejects 16-byte input, 64-byte input, and strings. A different prefix yields a key that cannot unwrap the entry.

**Acceptance.** No SHA-256-as-KDF remains in the module.

### Phase 5: UX and tests

#### #306: Missing step titles in the drawer header

**Solution.** A lookup that depends on the path taken, so numbering is right for both PAT and AET flows:

```ts
type Step = 'name' | 'wizard_step1' | 'wizard_step2' | 'scopes' | 'unlock_required' | 'done';

const PAT_TITLES: Partial<Record<Step, string>> = {
  name: '1. Name your key',
  scopes: '2. Choose permissions',
  done: '3. Save your key',
};
const AET_TITLES: Record<Step, string> = {
  name: '1. Name your key',
  wizard_step1: '2. Choose what it can open',
  wizard_step2: '3. Set limits',
  scopes: '4. Review',
  unlock_required: 'Unlock your vault',
  done: '5. Save your key',
};

const stepTitle = (step: Step, isAet: boolean) => (isAet ? AET_TITLES : PAT_TITLES)[step] ?? '';
```

**Tests.** A pure-function test: every `Step` has a non-empty title on the AET path, and every step reachable on the PAT path has one.

**Acceptance.** No step renders a blank header.

#### #312: Test coverage gaps in the zero-knowledge module

**Solution.** Rewrite `lib/security/zero-knowledge.test.ts` around the v1 API. The full matrix is in §11.1. Add a coverage gate for this file only (`vitest --coverage` with `include: ['lib/security/zero-knowledge.ts']`, lines 90% or more, branches 85% or more), so the gate does not affect the rest of the repo.

**Acceptance.** Every case in §11.1 exists and passes. The coverage thresholds are met.

#### #315: VS Code `copyAgentKey` has no validation

**Solution.** Shared validator in `packages/vscode/src/aet.ts` that wraps `parseAgentToken` (imported the same way the extension already imports from `@/packages/cli/src/...`):

```ts
export function validateAgentKeyInput(value: string): string | undefined {
  const r = parseAgentToken(value);
  if (r.ok) { r.token.unlockBytes.fill(0); return undefined; }
  switch (r.reason) {
    case 'empty': return 'Paste your private agent key.';
    case 'legacy_format': return 'This key uses an old format. Create a new one in Settings > Developers.';
    case 'wrong_type': return 'This looks like a regular access key. Private agent keys start with kyl_aet_.';
    default: return 'This key is incomplete or has a typo.';
  }
}

export async function promptForAgentKey(prompt: string) {
  return vscode.window.showInputBox({
    prompt, placeHolder: 'kyl_aet_…', password: true, ignoreFocusOut: true,
    validateInput: validateAgentKeyInput,
  });
}
```

`copyAgentKey`: after a successful copy, schedule a 60-second check that clears the clipboard if it still equals the token. Message: "Copied. Your clipboard will be cleared in 1 minute."

**Tests.** The validator returns the expected message for each fixture class.

**Acceptance.** Invalid input cannot be confirmed in the input box.

#### #316: Wizard state lost when the drawer closes

**Solution.** Keep the global unmount policy (`keepMounted={false}`, conditional render). Persist a **non-secret draft** to `sessionStorage` (tab-scoped, gone when the tab closes):

```ts
const draftKey = `kylrix:create-key-draft:${isWorkspace ? workspaceId : 'personal'}`;
type Draft = {
  name: string; isAetToken: boolean; permittedVault: boolean; permittedTotp: boolean;
  permittedNotes: boolean; aetExpiryDays: number; allowServerUnseal: boolean;
  selected: PatScope[]; step: Exclude<Step, 'done' | 'unlock_required'>;
};
```

- On open: if a draft exists, restore it and show a small "Picked up where you left off · Start over" bar. Otherwise reset to defaults (current behavior).
- Save on each change (debounced 250 ms).
- Clear on successful create and on "Start over".
- **Never** store `token`, unlock bytes, wrapped DEKs, or the `done` step.

**Tests.** Extract `loadDraft` / `saveDraft` / `clearDraft` as pure helpers over a `Storage` interface. Test: restore, the `done` step is never saved, it is cleared after create, and corrupt JSON falls back to defaults.

**Acceptance.** Close the drawer midway, reopen it, and the wizard resumes. After minting, reopening starts fresh.

#### #317: Wizard permissions not mapped to PAT scopes

**Problem.** The resource checkboxes have no effect, and #317's sketch references a `totp:read` scope that does not exist in `lib/api/scopes.ts`. TOTP routes are gated by vault scopes today (`resources.ts` around line 3160).

**Solution.** For AETs, scopes are **derived, not chosen**. The `scopes` step becomes a read-only review on the AET path.

```ts
export function deriveAetScopes(r: AetResources): PatScope[] {
  const s = new Set<PatScope>(['profile:read']);
  if (r.vault || r.totp) s.add('vault:read');
  if (r.notes) s.add('notes:read');
  return [...s];
}
```

Resource-level limits are enforced separately from scopes. A token with `vault:read` because of `totp: true` must **not** read credentials. The AET handlers check `actor.aet.resources[kind]` on every Row (§7.4). If no resource is picked, the wizard's next button is disabled with "Pick at least one item type."

**Tests.** Each of the 7 non-empty resource combinations maps to the expected scope set. An AET with `{ totp: true }` gets 403 on credential reads and 200 on TOTP reads.

**Acceptance.** The minted Row's `permissions` equals `deriveAetScopes(resources)`. The UI review step shows exactly those scopes.

#### #318: Redundant and ineffective clearing in `connectAgentCommand`

**Solution.** Superseded by the #303 rewrite. Secrets are held as `Uint8Array` inside `openAetSession`, cleared once by `session.close()` from a single `finally`. Remove the `etkSecret` string variable and the unused `childEnv`.

**Tests.** `close` is called exactly once on success, on error, and on signal.

**Acceptance.** No string reassignment presented as clearing remains in `packages/cli`.

### Phase 6: Documentation

#### #319: Docs describe unimplemented features

**Interim (lands with Phase 1).** Add one line under the README's AET heading and the matching `docs/security-and-vault.md` section:

> "Being finished: private agent keys are rolling out. Track progress in issues #300 to #319."

**Final (after Phases 3 and 5).**
- `README.md` §"Zero-Knowledge Secrets": `kyl_aet_` format; `kylrix agents connect`; `kylrix exec --agent-token`; curl with `X-Kylrix-Agent-Token`, marked as needing "Allow simple web requests" on the key.
- `docs/security-and-vault.md`: replace the `wrappedDeks` JSON with the v1 entry (§3.3); document HKDF, AAD, revoke-shred, MEK-only upgrade, string-clearing limits.
- `docs/cli.md`: `agents connect`, `exec --agent-token`, env naming table.
- `docs/api.md`: the two auth modes, `/api/v1/aet/self`, `/api/v1/aet/bundle`, error codes.
- `.agents/skills/security/SKILL.md`: add AET quirks (token halves, logical-kind map keys, 16-byte vs 12-byte IV formats, `--agent-token` vs global `--token`), per the `AGENTS.md` learning mandate.

**Acceptance.** Every command and header in the docs runs as written against `localhost:3005`.

---

## 6. Token Format Specification (normative)

### 6.1 Grammar

```abnf
aet          = access "." unlock
access       = "kyl_aet_" prefix "_" auth-secret
prefix       = 10( %x61-7A / %x32-37 )          ; a-z, 2-7
auth-secret  = 43( ALPHA / DIGIT / "-" / "_" )  ; base64url, 32 bytes, no padding
unlock       = "etk_" 64( %x30-39 / %x61-66 )   ; lowercase hex, 32 bytes
```

Total length: 8 + 10 + 1 + 43 + 1 + 4 + 64 = **131 characters**.

### 6.2 Parsing rules

1. Trim surrounding whitespace only. No inner normalization (no case folding).
2. Must match `AET_TOKEN_RE` exactly. Partial matches are invalid.
3. `kyl_apk_` plus `.` gives `legacy_format`. Any other non-`kyl_aet_` input gives `wrong_type`.
4. The parser returns `unlockBytes` as a fresh `Uint8Array`. The caller owns and clears it.

### 6.3 Versioning

- Token string version is implied by `kyl_aet_` (v1). A future v2 uses a new tag (for example `kyl_aet2_`), never a changed grammar under the same tag.
- Entry version is `entry.v`. Readers reject unknown versions (`unsupported`).

### 6.4 Migration strategy

| Item | Action |
|---|---|
| Existing `kyl_apk_<prefix>_<secret>` Agent Provisioning Keys | No change. Keep working. |
| `kyl_apk_<id>.<etk>` strings | Never issued (#301), so nothing to convert. Rejected everywhere with `legacy_format` and a "create a new key" message. |
| `apikey` Rows | No schema change. New Rows use `category = 'agent_enclave_token'`. |
| Crypto API | `encryptPayload`, `decryptPayload`, `wrapDEK`, `unwrapDEK`, `createWrappedDekMap`, `unwrapDekFromMap`, `zeroClearStrings`, `deriveKeyFromSecret` are deleted. Only tests call them today. |
| CLI | `connect` and `exec --agent-token` are new; existing flags unchanged. Patch bump per CLI-touching phase. |

---

## 7. API Changes

### 7.1 Authentication matrix

| `Authorization` | `X-Kylrix-Agent-Token` | Result |
|---|---|---|
| `Bearer kyl_aet_<tokenId>` | absent | AET actor, private mode |
| `Bearer kyl_aet_<tokenId>.etk_…` | absent | AET actor, private mode. Unlock part discarded and zeroed. Response header `X-Kylrix-Warning: aet-unlock-part-ignored` |
| absent | full AET | AET actor; server unlock if `allowServerUnseal`, else 403 `aet_server_unseal_disabled` |
| `Bearer kyl_aet_X…` | full AET with the same access part | Same as the previous row |
| any non-AET credential | full AET | 400 `conflicting_credentials` |
| `Bearer kyl_apk_….…` | any | 401 `legacy_aet_format` |
| existing PAT/OAuth/session | absent | Unchanged |

### 7.2 Guard implementation

```ts
function extractAgentToken(req: NextRequest): string | null {
  const v = req.headers.get('x-kylrix-agent-token');
  return v ? v.trim() : null;
}

export async function resolveApiActor(req: NextRequest): Promise<ApiActor> {
  const bearer = extractBearer(req);
  const agentHeader = extractAgentToken(req);

  if (bearer?.startsWith('kyl_apk_') && bearer.includes('.')) throw apiError(401, 'legacy_aet_format', LEGACY_MSG);

  if (agentHeader || bearer?.startsWith('kyl_aet_')) {
    if (bearer && !bearer.startsWith('kyl_aet_') && agentHeader) {
      throw apiError(400, 'conflicting_credentials', 'Send either an access key or a private agent key, not both');
    }
    return resolveAetActor(req, { bearer, agentHeader });
  }
  // ...existing PAT / OAuth / session paths unchanged...
}

async function resolveAetActor(req: NextRequest, src: { bearer: string | null; agentHeader: string | null }) {
  let accessToken: string;
  let unlockBytes: Uint8Array | null = null;
  let warning = false;

  if (src.agentHeader) {
    const p = parseAgentToken(src.agentHeader);
    if (!p.ok) throw apiError(401, p.reason === 'legacy_format' ? 'legacy_aet_format' : 'invalid_aet', 'Invalid private agent key');
    accessToken = p.token.accessToken;
    unlockBytes = p.token.unlockBytes;
    if (src.bearer && src.bearer.split('.')[0] !== accessToken) {
      unlockBytes.fill(0);
      throw apiError(400, 'conflicting_credentials', 'Keys do not match');
    }
  } else {
    const [access, rest] = src.bearer!.split('.', 2);
    if (rest !== undefined) {
      warning = true;
      const p = parseAgentToken(src.bearer);
      if (p.ok) p.token.unlockBytes.fill(0);   // decoded only so it can be zeroed
    }
    accessToken = access;
  }

  try {
    const verified = await PatService.verifyAetAccess(accessToken); // hash lookup, enabled, expiry, category
    if (!verified) throw apiError(401, 'invalid_aet', 'Invalid or turned-off private agent key');
    assertShieldAllowed(enforcePatBurstShield(verified.pat.$id));
    const { limits } = await enforceApiRateLimits({ userId: verified.userId, patId: verified.pat.$id });

    let unlock: { wrapKey: CryptoKey } | undefined;
    if (unlockBytes) {
      if (!verified.aet.allowServerUnseal) {
        throw apiError(403, 'aet_server_unseal_disabled',
          'This key does not allow simple web requests. Use the Kylrix CLI, or turn this on for the key in Settings.');
      }
      unlock = { wrapKey: await ZeroKnowledgeModule.deriveAetWrappingKey(unlockBytes, verified.aet.prefix) };
    }

    return {
      userId: verified.userId,          // always the human owner (Account Sovereignty invariant)
      kind: 'aet' as const,
      patId: verified.pat.$id,
      category: 'agent_enclave_token',
      isAgent: true,
      workspaceId: verified.pat.workspaceId || null,
      scopes: verified.scopes,
      rateLimits: limits,
      aet: { prefix: verified.aet.prefix, resources: verified.aet.resources, allowServerUnseal: verified.aet.allowServerUnseal, unlock },
      warning,
    };
  } finally {
    unlockBytes?.fill(0);
  }
}
```

`verifyAetAccess` reuses the `verifiedPatCache` pattern. The cache key is `sha256(accessToken)` and **never** anything derived from the unlock part. The cached value excludes `wrappedDeks`, which are loaded per request, so a revoke-shred takes effect immediately.

### 7.3 New endpoints

| Method / path | Auth | Scope | Response |
|---|---|---|---|
| `GET /api/v1/aet/self` | AET (either mode) | `profile:read` | `{ name, prefix, resources, allowServerUnseal, expiresAt, rowCount, createdAt }` |
| `GET /api/v1/aet/bundle?only=vault,totp,notes` | AET, private mode | derived | `{ rows: [{ kind, id, title, fields: {name: b64,…}, entry }], stale: string[], missing: number }` |

Bundle rules:
- Only Rows referenced in `metadata.aet.wrappedDeks`, still owned by `actor.userId`, not deleted, and (for workspace tokens) still linked to the workspace.
- `fields` contains only the encrypted fields from `VAULT_ENCRYPTED_FIELDS` (credentials, totpSecrets) or the note body. These are ciphertext as stored.
- A Row whose `dek` changed since minting is listed in `stale` (detect by storing `sha256(row.dek)` as `entry.dekRef` at mint time; this optional field is additive to v1).
- Pagination: `?cursor=` with 200 Rows per page.
- Server-unlock requests to `/aet/bundle` return 400 `use_private_mode`. Bundles are for clients that decrypt locally.

### 7.4 Existing read routes in server-unlock mode

For `GET /api/v1/vault/:id`, `GET /api/v1/vault`, `GET /api/v1/totp/:id`, `GET /api/v1/totp`, and note reads, when `actor.kind === 'aet'`:

1. Require `actor.aet.resources[kindFor(route)]`, else 403 `aet_resource_not_allowed`.
2. Look up `metadata.aet.wrappedDeks[`${kind}:${id}`]`. If missing, return 404 `aet_item_not_covered` (do not reveal whether the Row exists).
3. If `actor.aet.unlock` is set: unwrap the DEK, decrypt fields with `decryptRowField`, return plaintext over TLS, and zero-fill the DEK in `finally`.
4. If not set (private mode on a normal route): return the existing metadata-only shape plus `{ sealed: true }`.
5. All write routes return 403 `aet_read_only` for AET actors.

These checks go in a small helper `aetReadGate(actor, kind, rowId)` called at the top of each handler, so the existing MEK paths stay untouched.

### 7.5 Error codes

| Code | HTTP | User-facing message |
|---|---|---|
| `invalid_aet` | 401 | "Invalid or turned-off private agent key." |
| `legacy_aet_format` | 401 | "This key uses an old format. Create a new one in Settings > Developers." |
| `conflicting_credentials` | 400 | "Send either an access key or a private agent key, not both." |
| `aet_server_unseal_disabled` | 403 | "This key does not allow simple web requests. Use the Kylrix CLI, or turn this on for the key in Settings." |
| `aet_resource_not_allowed` | 403 | "This key cannot open this type of item." |
| `aet_item_not_covered` | 404 | "This item is not covered by this key." |
| `aet_read_only` | 403 | "Private agent keys can only read." |
| `use_private_mode` | 400 | "Use the Kylrix CLI to download items for this key." |

`jsonErr` must never include header values, token fragments, or decrypted fields in `message`.

### 7.6 MCP

`app/api/v1/mcp/route.ts` resolves actors through the same guard, so AET actors work in MCP automatically. Vault and TOTP tools inherit `aetReadGate`. The local `kylrix mcp` (stdio) runs in private mode: on start it reads `$KYLRIX_AGENT_KEY`, calls `openAetSession`, serves tool calls from the in-memory session, and calls `close()` on exit.

---

## 8. CLI Changes (summary)

| Command | Change | Files |
|---|---|---|
| `kylrix agents connect` | New: register (#302) and implement (#303, #318) | `src/index.ts`, `src/commands/agents.ts`, `src/aet/session.ts` |
| `kylrix exec --agent-token` | New flag, `idOrUrl` optional (#308) | `src/index.ts`, `src/commands/exec.ts` |
| `kylrix whoami` / auth detect | Recognize `kyl_aet_` as "Private Agent Key"; `kyl_apk_*.*` gives the legacy message (#300) | `src/commands/auth.ts` |
| `kylrix mcp` | Private-mode AET session when `$KYLRIX_AGENT_KEY` holds an AET | MCP command file |
| Client | `client.aet.self()`, `client.aet.bundle()` | `src/client` |
| Version | `1.0.20` to `1.0.21` (Phase 2), `1.0.22` (Phase 3) | `package.json`, `src/updater/index.ts` |

Rules:
- Never print token material or decrypted values, including under `--json`. `--json` for `connect --check` outputs `{ name, resources, counts, expiresAt, stale }` only.
- Never write tokens or plaintext to disk (no config cache, no temp files).
- Interactive token entry uses a masked prompt.

---

## 9. UI Changes: `CreatePatDrawer.tsx`

### 9.1 Flow

```
name ──(AET off)──> scopes (choose) ──> done
  └──(AET on)──> wizard_step1 (what it can open)
                   ──> wizard_step2 (limits + simple web requests toggle)
                   ──> scopes (read-only review) ──[vault locked?]──> unlock_required
                   ──> done (show once, copy button, skipped-items note)
```

### 9.2 Required changes

1. `Step` adds `'unlock_required'`. Header uses `stepTitle(step, isAetToken)` (#306).
2. New state `allowServerUnseal` (default `false`) on `wizard_step2`.
3. `wizard_step1` "Next" is disabled when no resource is checked (#317).
4. On the AET path the `scopes` step renders `deriveAetScopes(resources)` as read-only chips plus the counts from `listAetEligibleRows` ("12 logins, 3 2FA codes"). It hides the sweep and preset controls.
5. `handleCreate` branches per #301. The standard PAT path is unchanged.
6. `done` step for AETs: no auto-copy; a "Copy" button that clears the clipboard after 60 seconds; a note if `skippedCount > 0`.
7. Draft persistence per #316.
8. Keep `keepMounted={false}`, `disablePortal`, `ModalProps={{ keepMounted: false }}`, and the `if (!open) return null` guard (global unmount policy). The confirm-upgrade prompt (§3.6) is an inline step, not a nested modal. If a dialog is unavoidable, render it conditionally.

### 9.3 Copy (layman-first)

The current copy uses "Zero-Knowledge", "DEKs", "etkSecret", "TTL", and "Agent Enclave", which `AGENTS.md` disallows in UI. Replacements:

| Location | Current | New |
|---|---|---|
| Toggle title | Agent Enclave Token (AET) | Private agent key |
| Toggle help | Enable Zero-Knowledge secret access. Generates a client-side `kyl_apk_...` token with an ephemeral secret key (`etkSecret`). | Lets an AI tool read the items you pick. Only you and the tool can read them. Kylrix can't. |
| Name step button | Next: Zero-Knowledge Wizard | Next: choose items |
| Step 1 header | Step 1: Select Permitted Target Resources | What can this key open? |
| Step 1 help | …decrypt using client-side wrapped DEKs. | Pick the types of items the tool can read. It can't change or delete anything. |
| Notes option sub-label | Zero-Knowledge locked document bodies | Your locked notes |
| Step 2 header | Step 2: Security & Expiry Policy | Set limits |
| Step 2 help | Configure token TTL expiration and access limits. | Choose when this key stops working. |
| Guarantee box | The client unlocks the local vault, wraps item DEKs… | Your browser locks a copy of each item's key with this new key. Kylrix only stores the locked copy. |
| New toggle | n/a | Allow simple web requests. Lets tools like curl read items by sending the full key to Kylrix. Easier, but less private. Off is safer. |
| No-expiry option | No Expiration | Never (not recommended) |
| Vault locked | n/a | Unlock your vault to create this key. [Unlock] |
| Done note | You won't be able to view this full token string again… | Save this key now. You won't see it again. Anyone with it can read the items you picked. |
| Skipped note | n/a | {n} items couldn't be added. You can try again later. |

---

## 10. VS Code Changes (summary)

| Command | Change |
|---|---|
| `kylrix.injectTerminalSecrets` | New transient terminal with `env`; masked, validated prompt; no `sendText` (#304) |
| `kylrix.copyAgentKey` | Masked, validated prompt; clipboard auto-clear after 60 seconds (#315) |
| Placeholders | `kyl_aet_…` everywhere |

---

## 11. Test Plan

Default commands (only run when validation is requested, per `AGENTS.md`):

```bash
pnpm vitest run lib/security lib/services/pats.test.ts lib/api
pnpm --filter @kylrix/cli test
pnpm --filter @kylrix/cli build
```

### 11.1 Unit tests: `lib/security/zero-knowledge.test.ts` (#312)

| Group | Cases |
|---|---|
| Token parse | valid v1; `''`; `null`; `undefined`; `123`; `{}`; `'kyl_aet_'`; prefix-only; empty access; empty unlock; extra `.`; uppercase hex; 63/65 hex chars; prefix with `_`, `1`, `8`, `0`, or uppercase; auth secret 42/44 chars; leading/trailing whitespace (accepted); inner whitespace (rejected); `kyl_apk_x.etk_…` gives `legacy_format`; `kyl_pat_…` gives `wrong_type` |
| Token format | round trip format to parse; rejects bad access part; rejects 31/33-byte unlock; output length 131 |
| Base64 | invalid chars; bad padding; length mod 4; expected-length mismatch; Node and browser paths identical |
| Buffers | subarray with offset; `SharedArrayBuffer` view (guarded); secret copies zeroed |
| HKDF | known-answer vector; rejects 16/64-byte input and strings; rejects bad prefix; different prefix gives a different key |
| Entry wrap/unwrap | round trip; AAD mismatch (prefix, kind, rowId each) gives `unlock_failed`; tampered `alg`/`kdf`/`v` gives `unsupported`; IV length 11/13 and ciphertext length 47/49 give `malformed`; bit flip gives `unlock_failed`; wrong key gives `unlock_failed`; error messages identical across failure causes |
| Row field | round trip; cross-compat with `vault-crypto.sealRowFields` / `unsealRowFields` both ways; `unwrapRowDekWithMek` reads `sealRowFields` output; empty string plaintext; 1 MB plaintext; 31/33-byte DEK rejected; string DEK rejected at runtime |
| IV uniqueness | 1,000 encryptions with one DEK give 1,000 distinct IVs |
| Concurrency | 50 parallel wrap/unwrap and encrypt/decrypt via `Promise.all` all succeed and match |
| Clearing | `withSecretBytes` zeroes on resolve and on reject |

### 11.2 Shared test vectors

`lib/security/__fixtures__/aet-v1-vectors.json`:

```json
{
  "prefix": "abcdefgh23",
  "unlockHex": "000102…1f",
  "dekHex": "a0a1…bf",
  "kind": "credential",
  "rowId": "01J0000000000000000000TEST",
  "iv": "AAECAwQFBgcICQoL",
  "expectedWrappedDek": "<filled in by the first implementation, then frozen>"
}
```

The web tests and the CLI tests both assert against this file. The CLI test imports it by relative path. A test-only `ivOverride` parameter is used **only** to produce vectors, and it is not exported from the module's public object.

### 11.3 Service and API tests

- `lib/services/pats.test.ts`: `parsePatToken` rejects every AET fixture; `createAet` validation (prefix, duplicate, ownership, cap, kind vs resources); `revoke` shreds `wrappedDeks`; `verifyAetAccess` rejects expired, revoked, and wrong-category Rows.
- `lib/api/guard.test.ts` (new): every row of the §7.1 matrix; unlock bytes are zeroed after resolve (spy on `fill`); the cache key never depends on the unlock part.
- `lib/api/resources` AET handlers: resource gate; not-covered gives 404; server-unlock returns plaintext; private mode returns `{ sealed: true }`; writes return 403; bundle excludes foreign, deleted, and unlinked Rows; stale detection.
- `CreatePatDrawer` helpers: `stepTitle`, `deriveAetScopes`, draft helpers, `buildAetMint` (§5, #301).

### 11.4 Integration test (in-process, no dev server)

`__tests__/aet.integration.test.ts` with an in-memory libSQL database seeded from `turso-schema.sql`:

1. Seed a user, an MEK, and two credentials plus one TOTP sealed with `sealRowFields`.
2. Run `buildAetMint` with the MEK as a `CryptoKey`, then `PatService.createAet`.
3. Call the bundle handler with an AET actor and decrypt with the CLI's `openAetSession` (client mocked to call handlers directly). Assert plaintext matches.
4. Call the vault-read handler in server-unlock mode and assert plaintext. Do it again with `allowServerUnseal = false` and assert 403.
5. Revoke, then assert 401 and that `wrappedDeks` is gone.

### 11.5 End-to-end (manual)

No Playwright and no agent-started dev servers (`AGENTS.md`). The user runs `pnpm dev` on port 3005. Then:

1. Settings > Developers > Create key > Private agent key: pick Vault + 2FA, 7 days, simple web requests off. Save the token.
2. `kylrix agents connect --check --agent-token "$AET"` shows correct counts.
3. `kylrix exec --agent-token "$AET" -- printenv | grep KYLRIX_VAULT_` shows names present.
4. `curl -H "X-Kylrix-Agent-Token: $AET" localhost:3005/api/v1/vault/<id>` returns 403 `aet_server_unseal_disabled`.
5. Mint a second key with simple web requests on and repeat step 4. Expect plaintext.
6. VS Code: "Inject terminal secrets" opens a new terminal with no scrollback trace.
7. Revoke both keys, then repeat steps 2 and 4. Expect 401.
8. `GET localhost:3005/api/dev/logs?limit=200` contains no `kyl_aet_` or `etk_` substring.

---

## 12. Security Checklist

Every Phase PR must tick all applicable items.

**Secret types**
- [ ] Unlock bytes, DEKs, and plaintext key material are `Uint8Array` at every function boundary. No `string` parameter accepts key material.
- [ ] Wrapping keys are non-extractable `CryptoKey`s.
- [ ] `ParsedAgentToken` has no field holding the raw full token string.

**Clearing**
- [ ] Every `Uint8Array` holding secret material is zero-filled in a `finally` (or via `withSecretBytes` / `withBufferCopy`).
- [ ] Copies made for WebCrypto are zero-filled after use.
- [ ] No code or doc claims that strings are cleared. Where strings are unavoidable (env vars, HTTP bodies, React state for the one-time display), the scope is minimal and the doc says so.
- [ ] The CLI child-exit path clears exactly once.

**No logging, no persistence**
- [ ] No `console.*`, `logDebug`, `logError`, toast, or error `message` includes token fragments, unlock bytes, DEKs, or decrypted fields.
- [ ] The `/api/dev/logs` ring buffer redacts `authorization` and `x-kylrix-agent-token`.
- [ ] `jsonErr` never echoes request headers.
- [ ] Nothing writes tokens or plaintext to disk: no CLI config, temp files, VS Code `globalState`/`secrets`, `localStorage`, or `sessionStorage` (drafts exclude secrets).
- [ ] No `terminal.sendText` with token material.
- [ ] No auto-copy of AETs. Manual copy auto-clears after 60 seconds.

**Server**
- [ ] The server stores only `sha256(accessToken)`, the prefix, and wrapped entries. Never the unlock part.
- [ ] The verification cache key derives from the access part only. Cached data excludes `wrappedDeks`.
- [ ] Server-unlock is opt-in per token, defaults off, and is labeled as less private in the UI.
- [ ] `userId` on every actor is the human owner. Workspace stamping and the `workspace_objects` join are applied for workspace tokens.
- [ ] Bundle and read paths re-check Row ownership, deletion, and workspace linkage on every request.
- [ ] Revoke shreds `wrappedDeks`.
- [ ] AET actors cannot mint, revoke, or update PATs/AETs (`createAetSecure` requires a session actor; `pats:write` is never in derived scopes).

**Crypto**
- [ ] HKDF-SHA256 with token-bound salt and versioned `info`. Input exactly 32 bytes.
- [ ] AES-256-GCM with a 12-byte random IV per entry and AAD binding `prefix|kind|rowId`.
- [ ] Entry `v`, `alg`, `kdf`, IV length, and ciphertext length are validated before decrypt.
- [ ] One generic error for all unlock failures.
- [ ] Strict base64 decoding with identical behavior in Node and the browser.
- [ ] Web and CLI pass the shared test vectors.

---

## 13. Related Findings (out of scope, file separately)

1. **PAT prefix can contain `_`.** `PatService.create` builds `tokenPrefix` from `randomBytes(6).toString('base64url')`, whose alphabet includes `_`. `parsePatToken` splits on the first `_`, so any prefix containing `_` fails lookup. That is about $1 - (63/64)^8 \approx 11.8\%$ of newly minted PATs. Fix: generate the prefix from an alphabet without `_` (as AET does), or split using the known 8-character length. Not part of #300 to #319, but it affects the same parser.
2. **`createPat` in `lib/api/resources.ts` ignores `isWorkspace`/`workspaceId`/`keyCategory`.** Callers using the REST route cannot mint workspace PATs. AET creation deliberately goes through the server action, not this route.
3. **Legacy `systemTables()` / `APPWRITE_CONFIG` access in vault handlers.** `AGENTS.md` calls for removing these shims. AET handlers should read Rows through a thin `AetRowSource` interface (`getRows(kind, ids)`), so they move to direct Turso access unchanged when the shim is deleted.

## 14. Open Decisions (defaults chosen; revisit in review)

| Decision | Default in this spec | Alternative |
|---|---|---|
| Where wrapped DEKs live | `apikey.metadata` with a 1,000-Row cap | New `aet_wrapped_deks` Table in `turso-schema.sql` (no cap, indexed stale checks) |
| Server-unlock mode | Supported, opt-in per token, default off | Drop it entirely (purest private design; README curl example removed) |
| CLI crypto source | Import `lib/security/zero-knowledge.ts`, bundled by tsup | Vendored copy plus shared vectors |
| Rows without DEKs | One-time upgrade at mint, after confirmation | Skip and report only |
| CLI flag name | `--agent-token` (avoids clobbering global `--token`) | `--token` as written in #302/#308, after renaming the global flag |
