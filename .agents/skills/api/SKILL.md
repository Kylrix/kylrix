---
name: api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST toward UI
  parity: notes, goals, flows (+install), workspaces, events, forms, feeds,
  moments (internal view & comments), threads (unified plaintext
  discussions), chats (E2EE meta; plaintext send when unencrypted), vault
  metadata, tags, objects, agents/harness, and token self-service. Not a 1:1
  UI clone — E2EE unlock, WebRTC calls stay client-side.
---

# Kylrix HTTP API (PAT)

**Wire-in guide:** [docs/integrations.md](../docs/integrations.md)

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
export KYLRIX_PAT='kyl_pat_…'
export BASE="${KYLRIX_API_BASE:-https://www.kylrix.space/api/v1}"
```

MCP and REST share `ApiResources` — prefer MCP for IDE agents, REST for scripts. Same PAT, same scopes.

## Honest parity

| UI area | PAT API | Notes |
|---------|---------|-------|
| Ideas (notes) | Full CRUD | ✅ |
| Goals | Full CRUD | ✅ |
| Workspaces | Full CRUD + nested projects | ✅ |
| Discussions | `GET/POST /threads?parent_kind=&parent_id=` | ✅ Unified thread model |
| Feeds | GET `/feeds` | ✅ |
| Moments | List/get/create + comments | ✅ Internal comments |
| Chats | List/get/messages; POST if unencrypted | ❌ E2EE send needs unlocked vault |
| Vault | List metadata + Dual-Mode unseal | ✅ Sealed by default (Zero-Trust); on-the-fly unseal via MasterPass/MEK/shareKey |
| Public Vault Bootstrap | `GET /vault/public/:id` (No auth) | ✅ Zero-auth .env/secret bootstrapping via share URL key |
| Agents + harness mirror | List/get/delete + mirror append | ✅ |
| Calls / WebRTC | — | Client realtime only |
| CLI Auth | `POST /auth/signup`, `POST /auth/signin` | ✅ Sign up or log in via CLI with email/password; returns user + minted PAT |
| Billing & x402 | `POST /billing/checkout`, `GET /billing/status`, `GET /billing/coins`, `POST /billing/coupon` | ✅ Plan upgrades via BlockBee hosted URL or direct on-chain crypto address (`ticker`) |
| Token self-scope refresh | ✅ | Rescue hatch — no remint |

## Rescue hatch

```bash
curl -sS -X POST "$BASE/token/scopes" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"mode":"grant","scopes":["moments:read","moments:write","chats:read","chats:write","workspaces:read","billing:read","billing:write"]}'
```

## Routes (summary)

`/auth/signup` · `/auth/signin` · `/auth/status`  
`/billing/checkout` · `/billing/status` · `/billing/coins` · `/billing/coupon`  
`/me` · `/token` · `/token/scopes` · `/pats`  
`/notes` · `/goals` · `/workspaces` · `/projects` · `/workspaces/:id/projects` · `/events` · `/forms`  
`/flows` · `/flows/installations` · `/flows/:id/installations`  
`/feeds` · `/moments` · `/moments/:id` · `/moments/:id/comments`  
`/threads` · `/threads/:id` · `/threads/:id/messages`  
`/chats` · `/chats/:id` · `/chats/:id/messages`  
`/vault` · `/vault/:id` · `/vault/public/:id` · `/vault/mek` · `/tags` · `/objects`  
`/agents/sessions` · `/agents/harness` · `/agents/sessions/:id/mirror`

## x402 Protocol & Autonomous Upgrade Flow

When an agent or client reaches account/plan limits or attempts a Pro-gated action:
- **HTTP 402 Payment Required** is returned.
- **Headers**:
  - `X-Payment-Required: true`
  - `X-402-Plan: PRO_MONTH`
  - `X-402-Price-USD: 10.00`
  - `X-402-Checkout-Url: https://www.kylrix.space/pricing`
  - `X-402-Api-Endpoint: /api/v1/billing/checkout`
- **Payload**:
  ```json
  {
    "ok": false,
    "error": {
      "code": "payment_required",
      "message": "Payment required to access this feature.",
      "plan": "PRO_MONTH",
      "priceUsd": 10.0,
      "checkoutUrl": "https://www.kylrix.space/pricing",
      "apiCheckoutEndpoint": "/api/v1/billing/checkout",
      "hint": "Call POST /api/v1/billing/checkout with your desired plan to generate a payment session or direct crypto address."
    }
  }
  ```
- **Fulfillment**: The caller queries `GET /api/v1/billing/coins` for available tickers, calls `POST /api/v1/billing/checkout` (with `planId` and optional `ticker` e.g. `polygon/usdt`), broadcasts the transaction, and the BlockBee webhook automatically upgrades the account upon on-chain confirmation.

## Vault & Secrets Dual-Mode Architecture

Kylrix supports **Dual-Mode Secret Access** across both REST and MCP:

1. **Zero-Trust / Client-Side Decryption (Default / Light Lifting)**:
   - Requesting a vault credential returns the sealed ciphertext fields along with the wrapped DEK (`dek`).
   - Active client applications decrypt locally using their stored MEK. The server never sees secret plaintext or master passwords.

2. **Server-Assisted Decryption (Passive Clients / Dumb CLIs / Heavy Lifting)**:
   - **Public Shared Secrets (`GET /api/v1/vault/public/:id?shareKey=...&format=env`)**:
     - Requires **zero authentication** (no PAT, no session).
     - Resolves public credentials and decrypts them directly using the `shareKey` / DEK extracted from the public share URL (`https://www.kylrix.space/vault/:id/:key` or `#key`).
     - Supports `format=env` or `Accept: text/plain` to stream formatted `.env` files straight to automated deployments or dev setups.
   - **With Master Password (`X-Master-Password` / `masterPassword`)**:
     - Authenticated requests can pass the user's Master Password.
     - The server verifies the password against the user's `keychain` row using **Argon2id** (memory: 64MB, iterations: 3, parallelism: 4) or legacy PBKDF2 fallback, unwraps the MEK, decrypts the record fields, and returns plaintext or `.env` strings on the fly.
   - **With Direct MEK (`X-Kylrix-MEK` / `mek`)**:
     - The server imports the 32-byte MEK directly, unwraps the record DEK, and decrypts the requested fields.
   - **MEK Unlock (`GET /api/v1/vault/mek` / `POST /api/v1/vault/mek/unlock`)**:
     - If `masterPassword` is provided: derives and returns the unwrapped MEK (hex + base64).
     - If `masterPassword` is omitted: returns the raw encrypted keychain blob (`{ wrappedKey, salt, params, isArgon }`) for client-side unlocking.

## Cryptographic Hierarchy

```
Master Password + Salt (32 bytes)
       │
       ▼ (Argon2id: 64MB memory, 3 iterations, 4 parallelism)
Key Encryption Key (KEK, AES-256-GCM)
       │
       ▼ (Unwraps keychain.wrappedKey)
Master Encryption Key (MEK, 32 bytes)
       │
       ▼ (Unwraps credential.dek)
Data Encryption Key (DEK, AES-256-GCM)
       │
       ▼ (Decrypts fields: name, password, notes, customFields)
Plaintext Credentials & Environment Variables
```

## Account Sovereignty & Workspace Scoping (STRICT)

- **User ID Invariant**: All objects created by agents, REST API, or MCP belong to the authenticated human user's account (`userId`). The API server inspects and overrides `userId` on every entity row with the account owner's ID to prevent orphaned ghost objects.
- **Workspace Stamping**: When creating objects in a workspace, `/api/v1` and MCP automatically stamp `isWorkspace: true` and `projectId: <wsId>` on the entity row AND create the `project_objects` join record so items are correctly scoped and isolated.

Full table: `api/references/http-api.md`. Internal: `system.pat-http-api`.
