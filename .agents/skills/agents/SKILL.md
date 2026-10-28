---
name: agents
description: Autonomous AI agents in Kylrix. Provisioning keys, MEK client-side encryption, multi-chain sovereign identity, and REST endpoints.
---

# Autonomous AI Agents Architecture

## 1. Agent Provisioning & Zero-Trust Keys
- Autonomous agents operate strictly within designated agentic workspaces (\`isAgentic: true\`).
- Authenticate via zero-trust Agent Provisioning Keys.

## 2. Sovereign Identity & Multi-Chain Derivation
- Each agent receives a sovereign 12-word BIP-39 mnemonic phrase deriving deterministic EVM, Solana, Bitcoin, and Sui addresses.
- Agent MEK is encrypted with the user Master Key (Gold Key -> Silver Key hierarchy).
- All entity creations inherit the human account \`userId\` to prevent orphaned rows.

## Agent Enclave Tokens (`kyl_aet_`) — CLI entry points

- `kyl_aet_` agent keys grant scoped read access to chosen vault items/TOTP codes; the `etk_` unlock part never leaves the client (see `packages/cli/src/enclave.ts`, `lib/security/zero-knowledge.ts`).
- `kylrix agents connect [--claude-code|--cursor|--check| -- cmd ...]` verifies the key via `GET /api/v1/token/enclave`, prints what it can open, then spawns the tool with `KYLRIX_AGENT_KEY` set and `KYLRIX_TOKEN` removed.
- `kylrix exec [id] -- <cmd>` with an AET in `--token`/`KYLRIX_AGENT_KEY` decrypts granted rows client-side (`?sealed=1` reads) and injects env vars; child env drops the agent key.
- `kyl_apk_` provisioning keys are a separate, unchanged namespace.
