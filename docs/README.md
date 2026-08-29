# Kylrix Ecosystem Documentation

Developer docs for **integrators** — mobile apps, agents, and custom clients on Kylrix.

**Start here:** [**Wire any agent in 60 seconds →**](./integrations.md)

---

## Documentation Index

| Section | Description | Link |
|---|---|---|
| **Agent Integrations** | Copy-paste prompt, MCP + REST setup, verify checklist | [integrations.md](./integrations.md) |
| **Model Context Protocol (MCP)** | Streamable HTTP & SSE for Cursor, Claude, agents | [mcp.md](./mcp.md) |
| **HTTP API** | PATs, scopes, REST endpoints | [api.md](./api.md) |
| **Sign in with Kylrix (OAuth 2.1)** | OIDC, PKCE, client registration | [oauth2.md](./oauth2.md) |
| **Autonomous Agents** | Provisioning keys, workspaces, identities | [agents.md](./agents.md) |
| **Markdown Pipeline** | Marked extensions, KaTeX, charts | [markdown.md](./markdown.md) |
| **Self-Hosting** | Docker deploy, custom base URLs | [SELFHOST.md](../SELFHOST.md) |

---

## Agent Skills

```bash
npx skills add kylrix/kylrix/mcp
npx skills add kylrix/kylrix/api
npx skills add kylrix/kylrix/agents
npx skills add kylrix/kylrix/oauth2
```

---

## Production Endpoints

- **Web app**: [https://www.kylrix.space](https://www.kylrix.space)
- **REST API**: `https://www.kylrix.space/api/v1`
- **MCP**: `https://www.kylrix.space/api/v1/mcp`
- **OAuth discovery**: `https://www.kylrix.space/.well-known/openid-configuration`

Self-hosted deployments: substitute your own host — see [SELFHOST.md](../SELFHOST.md).
