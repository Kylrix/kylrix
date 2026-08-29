# Wire Any Agent Into Kylrix

For **integrators** building apps, mobile clients, or agent workflows on Kylrix — not for hacking on the Kylrix repo itself. Self-hosters: see [SELFHOST.md](../SELFHOST.md).

Copy this to your coding agent:

> **Wire me into Kylrix.** Install skills `kylrix/kylrix/mcp`, `kylrix/kylrix/api`, and `kylrix/kylrix/agents`. Mint a PAT in **Settings → Developers** on [kylrix.space](https://www.kylrix.space) (`kyl_pat_…`). Add MCP to `.cursor/mcp.json` (copy `.cursor/mcp.json.example`, paste token, never commit secrets). Set `KYLRIX_PAT` and `KYLRIX_API_BASE=https://www.kylrix.space/api/v1`. Verify `GET /me` and MCP `list_workspaces`. Prefer **MCP** for IDE agents; **REST** for mobile/scripts.

---

## 1. Install Agent Skills

```bash
npx skills add kylrix/kylrix/mcp
npx skills add kylrix/kylrix/api
npx skills add kylrix/kylrix/agents
```

| Skill | When to use |
|-------|-------------|
| `mcp` | Cursor, Claude Desktop, Claude Code — native tool calls |
| `api` | Mobile apps, shell scripts, CI, custom backends — REST + PAT |
| `agents` | Autonomous agents — provision keys, workspaces, `~/.kylrix/agents/` |

---

## 2. Mint a Token

On **[kylrix.space](https://www.kylrix.space)** → **Settings → Developers** → Create PAT (`kyl_pat_…`). Grant scopes you need (`goals:read`, `notes:write`, `workspaces:read`, `chats:write`, etc.).

**Autonomous agents:** `POST https://www.kylrix.space/api/v1/agents/provision` with an Agent Provisioning Key. Store `agentToken` in `~/.kylrix/agents/<name>.json` — never in git.

---

## 3. Production Endpoints

```bash
export KYLRIX_PAT='kyl_pat_…'
export KYLRIX_API_BASE='https://www.kylrix.space/api/v1'
```

| | URL |
|---|-----|
| **REST API** | `https://www.kylrix.space/api/v1` |
| **MCP** | `https://www.kylrix.space/api/v1/mcp` |
| **OAuth discovery** | `https://www.kylrix.space/.well-known/openid-configuration` |

---

## 4. Connect MCP (Recommended for IDE Agents)

Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `.cursor/mcp.json`, paste your PAT, reload the IDE.

```json
{
  "mcpServers": {
    "kylrix": {
      "type": "http",
      "url": "https://www.kylrix.space/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_PAT_TOKEN>"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"
```

### Smithery (one command)

```bash
npx -y @smithery/cli install kylrix/kylrix --client cursor
```

---

## 5. Verify

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" "$KYLRIX_API_BASE/me" | jq .

curl -sS -X POST "https://www.kylrix.space/api/v1/mcp" \
  -H "Authorization: Bearer $KYLRIX_PAT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_workspaces","arguments":{"limit":5}}}' \
  | jq .
```

---

## 6. MCP vs REST

Both call the same **`ApiResources`** in-process. Domain shapes (e.g. goals) live in **`sdk/contracts/goals.ts`**.

| | MCP | REST |
|---|-----|------|
| **Best for** | IDE agents, multi-step tool loops | Mobile apps, backends, CI |
| **Auth** | `Authorization: Bearer kyl_pat_…` | Same |
| **Goals** | `list_goals` (`workspaceId`, `status`) | `GET /goals?workspaceId=&status=` |

---

## 7. Self-Hosting

Running your own instance? See **[SELFHOST.md](../SELFHOST.md)** for Docker URLs and env setup. Production docs above use `kylrix.space`; swap the host for your deployment.

---

## Further Reading

- [MCP tools & transport](./mcp.md)
- [REST routes & scopes](./api.md)
- [Autonomous agents](./agents.md)
- [OAuth 2.1](./oauth2.md)
