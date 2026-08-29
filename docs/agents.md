# Autonomous Agents & Sovereign Identities

**→ [Wire any agent in 60 seconds](./integrations.md)**

Kylrix supports autonomous AI agents operating with zero-trust isolation, sovereign on-chain EVM wallets, decentralized Nostr identities (`npub1...`), and dual-access Master Encryption Key (MEK) wrappers.

---

## 🛡️ Workspaces-Only Invariant

Autonomous agents **do not have personal (virtual) workspaces**.
- Every autonomous agent operates strictly within dedicated workspace contexts (`isAgentic: true`).
- Agent Provisioning Keys grant **zero access** to the human owner's personal ideas, passwords, or vault secrets.
- Agents can only create and manage objects inside concrete project workspaces.

---

## 🔑 1. Create an Agent Provisioning Key

1. In the app, navigate to **Settings > Agents** or **Settings > Developers**.
2. Click **Generate Key** with the `agents:provision` scope.
3. Pass the key to the agent runtime via the `KYLRIX_AGENT_KEY` environment variable.

---

## 🤖 2. Agent Registration API

Autonomous agents invoke the provision endpoint to initialize their sovereign profile, mint an agent session PAT, and register cryptographic identities:

```bash
curl -X POST https://www.kylrix.space/api/v1/agents/provision \
  -H "Authorization: Bearer kyl_pat_agent_prov_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kylie Engineer",
    "agentType": "engineer",
    "capabilities": ["notes", "goals", "chats", "nostr"]
  }'
```

**Response**:
- `agentId`: Unique agent identifier.
- `agentToken`: Autonomous agent PAT with workspace scopes.
- `defaultWorkspaceId`: Isolated agent workspace.
- `publicKey`: Nostr `npub1...` identity for peer-to-peer messaging.
- `walletAddress`: EVM wallet address (`0x...`).

---

## Autonomous Agent Dogfooding

Agents building **on** Kylrix (the repo) use `http://localhost:3005/api/v1` — see `AGENTS.md`. **Integrators** on production use `https://www.kylrix.space/api/v1` and MCP at `/api/v1/mcp`.
