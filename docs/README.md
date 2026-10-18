# Kylrix Ecosystem Documentation

Comprehensive documentation for developers, integrators, and autonomous agents working with or extending the Kylrix platform.

**Start here:** [**Wire any agent in 60 seconds →**](./integrations.md)

---

## 📚 Documentation vs. Agent Skills (`.agents/skills/`)

- **System Documentation (`docs/`)**: Public and internal documentation answering all questions about system architecture, data models, edge cases, feature behavior, and API integrations. Intended for human developers, external integrators, and AI agents alike.
- **Agent Skills (`.agents/skills/`)**: Operational guides specifically tailored for autonomous agents and developers actively writing or modifying code in real-time. Contains non-negotiables, code quirks, implementation rules, invariants, and step-by-step modification guidelines.

---

## Documentation Index

| Section | Description | Link |
|---|---|---|
| **Workspaces Architecture** | Filtering rules, `project_objects` join mapping, edge cases | [workspaces.md](./workspaces.md) |
| **CLI & Stdio MCP Bridge** | Local-first SQLite, 1-click pairing, commands | [cli.md](./cli.md) |
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
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

Optional OAuth integrators: add `--skill oauth2` or use `--skill '*' -y` for everything.

---

## Production Endpoints

- **Web app**: [https://www.kylrix.space](https://www.kylrix.space)
- **REST API**: `https://www.kylrix.space/api/v1`
- **MCP**: `https://www.kylrix.space/api/v1/mcp`
- **OAuth discovery**: `https://www.kylrix.space/.well-known/openid-configuration`

Self-hosted deployments: substitute your own host — see [SELFHOST.md](../SELFHOST.md).
