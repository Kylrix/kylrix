# Kylrix Ecosystem Documentation

Comprehensive documentation for developers, integrators, and autonomous agents working with or extending the Kylrix platform.

**Start here:** [**Wire any agent in 60 seconds →**](./integrations.md)

---

## 📚 System Architecture & Core Technical Specs

| Section | Description | Link |
|---|---|---|
| **System Architecture** | High-level topology, local-first substrate, hybrid execution model | [architecture.md](./architecture.md) |
| **Database & Persistence** | Turso SQLite schema, Drizzle ORM, `resolveAllUserIds`, repository pattern | [database.md](./database.md) |
| **Security & Zero-Knowledge Vault** | E2EE Web Crypto, MasterPass Argon2id derivation, 2FA/Passkeys, RAM zeroing | [security-and-vault.md](./security-and-vault.md) |
| **Sync Engine & Realtime** | `autonomicSyncEngine`, queue flushes, PartyKit WebSockets, tombstones | [sync-and-realtime.md](./sync-and-realtime.md) |
| **Billing & Subscriptions** | BlockBee crypto infrastructure, `CONTRIBUTOR` tier, coupons, entitlements | [billing.md](./billing.md) |
| **Packages & TypeScript SDK** | `@kylrix/cli` terminal tool, VS Code extension, `@kylrix/sdk` contracts | [packages-and-sdk.md](./packages-and-sdk.md) |
| **Frontend UI & Design System** | OpenBricks design, desktop drawer suppression rules, guest local fallbacks | [frontend-ui.md](./frontend-ui.md) |

---

## 🔌 API Protocols & Agent Integrations

| Section | Description | Link |
|---|---|---|
| **Workspaces Architecture** | Personal vs Concrete workspaces, `project_objects` join mapping, edge cases | [workspaces.md](./workspaces.md) |
| **CLI & Stdio MCP Bridge** | Local-first SQLite store, 1-click pairing, `kylrix exec` RAM zeroing | [cli.md](./cli.md) |
| **Agent Integrations** | Copy-paste prompts, MCP + REST setup, verification checklist | [integrations.md](./integrations.md) |
| **Model Context Protocol (MCP)** | Streamable HTTP & SSE transport for Cursor, Claude, agents | [mcp.md](./mcp.md) |
| **WebMCP (W3C Standard)** | Browser-native tool exposition via `navigator.modelContext` | [webmcp.md](./webmcp.md) |
| **HTTP REST API** | PATs, scopes, REST endpoints summary | [api.md](./api.md) |
| **Sign in with Kylrix (OAuth 2.1)** | OIDC, PKCE flow, token endpoints | [oauth2.md](./oauth2.md) |
| **Autonomous Agents** | Agent provisioning, identities, authorization keys | [agents.md](./agents.md) |
| **Markdown Pipeline** | Marked custom extensions, KaTeX math, charts, quote cards | [markdown.md](./markdown.md) |
| **Pairing Protocol** | Device authentication, cryptographically secure pairing codes | [PAIRING_PROTOCOL.md](./PAIRING_PROTOCOL.md) |
| **Self-Hosting** | Docker deployment, custom base URIs, environment setup | [SELFHOST.md](../SELFHOST.md) |

---

## 📚 Documentation vs. Agent Skills (`.agents/skills/`)

- **System Documentation (`docs/`)**: Complete technical documentation answering all questions about system architecture, data models, edge cases, security, feature behavior, and API integrations. Intended for human developers, external integrators, and AI agents alike.
- **Agent Skills (`.agents/skills/`)**: Operational guides specifically tailored for autonomous agents and developers actively writing or modifying code in real-time. Contains non-negotiables, code quirks, implementation rules, invariants, and step-by-step modification guidelines.

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
