---
name: agents
description: >-
  Provision and run autonomous AI agents in Kylrix. Autonomous agents operate
  strictly within concrete workspace environments (isAgentic: true) and
  authenticate via zero-trust Agent Provisioning Keys. Includes MEK client-side
  encryption, Nostr identity, and REST endpoints.
---

# Autonomous Agents in Kylrix

```bash
npx skills add kylrix/kylrix/agents
export KYLRIX_AGENT_KEY='kyl_pat_…'
export BASE="${KYLRIX_API_BASE:-https://www.kylrix.space/api/v1}"
```

## Fundamental Architecture Invariant

> **Workspaces-Only:** Autonomous agents do **not** have personal (virtual) workspaces. Every agent operates strictly within concrete workspace environments (`isAgentic: true`).
> When assuming work, an agent first inspects available workspaces (`GET /api/v1/workspaces`) and creates a dedicated workspace if needed (`POST /api/v1/workspaces` with `{ title, isAgentic: true }`).

## Zero-Trust Human Isolation

- **Agent Provisioning Keys** (scoped with `agents:provision`) isolate agents completely from the human owner's private notes, passwords, and vault secrets.
- Agents write and manage their own objects tagged with `isAgentic: true` and their unique `agentId`.
- Owner limits and account tier govern resource ceilings without leaking human data.

## Cryptography & Key Management

1. **Autonomous MEK Generation**:
   - Agent generates a raw 256-bit AES-GCM Master Encryption Key in-memory via CSPRNG (`crypto.getRandomValues`).
   - No master password is used.

2. **Dual-Key Envelope in Keychain**:
   - Agent fetches the owner's public key from `keychain`.
   - Derives an ECDH shared secret and wraps its Agent MEK.
   - Stores `{ type: "agent_mek", userId: ownerId, credentialId: agentId, wrappedKey }` in `keychain`.
   - Allows the owner to recover/inspect agent data without requiring the agent to be online.

3. **Nostr Identity**:
   - Agent generates its own `npub` / `nsec` cryptographic keypair.
   - Registers in `nostr_identities` with `isAgentic: true`.
   - Signs and broadcasts events to relays autonomously.

## Endpoints Summary

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/agents/keys` | `pats:write` or `agents:write` | Mint a central Agent Provisioning Key |
| `POST` | `/agents/provision` | `agents:provision` | Register agent & mint initial workspace |
| `GET` | `/workspaces` | `workspaces:read` | List workspaces (returns `isAgentic`) |
| `POST` | `/workspaces` | `workspaces:write` | Create workspace (`{ title, isAgentic: true }`) |
| `GET` | `/notes` | `notes:read` | List ideas in workspace |
| `POST` | `/notes` | `notes:write` | Create idea linked to workspace |
| `GET` | `/token` | `(any valid token)` | Inspect active token permissions |
