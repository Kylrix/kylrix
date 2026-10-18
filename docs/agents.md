# Autonomous Agents & Sovereign Identities

**→ [Wire any agent in 60 seconds](./integrations.md)**

Kylrix supports autonomous AI agents operating with zero-trust isolation, sovereign on-chain EVM wallets, and dual-access Master Encryption Key (MEK) wrappers.

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
    "capabilities": ["notes", "goals", "chats"]
  }'
```

**Response**:
- `agentId`: Unique agent identifier.
- `agentToken`: Autonomous agent PAT with workspace scopes.
- `defaultWorkspaceId`: Isolated agent workspace.
- `walletAddress`: EVM wallet address (`0x...`).

---

## 🧠 Agent Continuous Learning & Skill Capture

When autonomous AI agents work within the Kylrix repository, they follow a strict anti-regression protocol:

1. **Document Learnings**: Whenever an agent resolves a non-trivial issue, deciphers fragile logic, or modifies core behaviors, it MUST capture its learnings in `.agents/skills/<topic>/SKILL.md` (or create a new skill directory if needed).
2. **Consult System Invariants**: Agents must consult `.agents/skills/invariants/SKILL.md` for non-negotiable rules regarding workspace filtering, entity stamping, and local storage tombstones.
3. **Real-World Bug Primacy**: Real-world bug reports and broken user experiences ALWAYS supersede locked-in invariants. If an invariant causes a bug in practice, agents must fix the code and update the documented invariant.

---

## Autonomous Agent Dogfooding

Agents building **on** Kylrix (the repo) use `http://localhost:3005/api/v1` — see `AGENTS.md`. **Integrators** on production use `https://www.kylrix.space/api/v1` and MCP at `/api/v1/mcp`.
