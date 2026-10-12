# Wire Any Agent Into Kylrix

For **integrators** — mobile apps, scripts, IDE agents, and autonomous agents on Kylrix. Self-hosters: [SELFHOST.md](../SELFHOST.md).

---

## Install skills (one command)

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

Optional — all skills including OAuth:

```bash
npx skills add kylrix/kylrix --skill '*' -y
```

| Skill | Covers |
|-------|--------|
| `mcp` | IDE tool calls (Cursor, Claude, Windsurf, Codex, …) |
| `api` | REST `/api/v1` — scripts, mobile, CI, backends |
| `agents` | Provisioning keys, harness sessions, `~/.kylrix/agents/` |
| `oauth2` | Sign in with Kylrix for third-party apps (optional) |

**Personal work** (notes, goals, vault) and **agentic work** (sessions, harness) share the same workspace. Most people install all three; REST stays relevant even when you use MCP day-to-day.

Copy-paste prompt for your coding agent:

> Install Kylrix skills: `npx skills add kylrix/kylrix --skill mcp --skill api --skill agents`. Mint a PAT at **Settings → Developers** (`kyl_pat_…`). Connect MCP via Smithery or `.cursor/mcp.json`. Set `KYLRIX_PAT` and `KYLRIX_API_BASE=https://www.kylrix.space/api/v1`. Verify `GET /me`. Use MCP in the IDE; use REST for scripts and mobile.

---

## Mint a token

**[kylrix.space](https://www.kylrix.space)** → **Settings → Developers** → Create PAT.

**Autonomous agents:** `POST /api/v1/agents/provision` with an Agent Provisioning Key. Store `agentToken` in `~/.kylrix/agents/<name>.json` — never in git.

---

## Endpoints

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

## Connect MCP

```bash
npx -y @smithery/cli install kylrix/kylrix --client cursor
npx -y @smithery/cli install kylrix/kylrix --client claude
npx -y @smithery/cli install kylrix/kylrix --client windsurf
npx -y @smithery/cli install kylrix/kylrix --client codex
npx -y @smithery/cli install kylrix/kylrix --client antigravity
```

Or copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `.cursor/mcp.json`, paste your PAT, reload IDE.

---

## Verify

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" "$KYLRIX_API_BASE/me" | jq .

curl -sS -X POST "$KYLRIX_API_BASE/mcp" \
  -H "Authorization: Bearer $KYLRIX_PAT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_workspaces","arguments":{"limit":5}}}' \
  | jq .
```

---

## MCP vs REST

Both hit the same **`ApiResources`** in-process.

| | MCP | REST |
|---|-----|------|
| **Best for** | IDE agents, multi-step tool loops | Mobile, backends, CI, shell scripts |
| **Auth** | `Authorization: Bearer kyl_pat_…` | Same |
| **Workspaces** | `list_workspaces` | `GET /workspaces` or `GET /projects` |
| **Nested projects** | `list_workspace_projects` | `GET /workspaces/:id/projects` |

---

## Further reading

- [REST routes & scopes](./api.md)
- [MCP tools](./mcp.md)
- [Autonomous agents](./agents.md)
- [OAuth 2.1](./oauth2.md)
