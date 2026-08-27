# Kylrix Ecosystem Documentation

Welcome to the developer documentation for the **Kylrix** open source productivity suite and agentic ecosystem.

---

## 📚 Documentation Index

| Section | Description | Link |
|---|---|---|
| 🤖 **Model Context Protocol (MCP)** | Streamable HTTP & SSE server for Claude Desktop, Cursor, Claude Code, and autonomous agents | [docs/mcp.md](./mcp.md) |
| ⚡ **HTTP API** | Personal Access Tokens (PATs), scopes, rate limits, and REST endpoints for all resources | [docs/api.md](./api.md) |
| 🔐 **Sign in with Kylrix (OAuth 2.1)** | OpenID Connect / OAuth 2.1 authorization code flow with PKCE, client registration, and custom scopes | [docs/oauth2.md](./oauth2.md) |
| 🧠 **Autonomous Agents** | Zero-trust Agent Provisioning Keys, sovereign EVM/Nostr identities, and workspace-only isolation | [docs/agents.md](./agents.md) |
| 📝 **Markdown Pipeline** | Custom marked extensions, quote copy cards, KaTeX math, charts, and file previews | [docs/markdown.md](./markdown.md) |

---

## 📦 Agent Skills Quick Install

Kylrix provides official skills for AI developer agents:

```bash
# Model Context Protocol (MCP) Server
npx skills add kylrix/kylrix/mcp

# REST HTTP API
npx skills add kylrix/kylrix/api

# Sign in with Kylrix (OAuth 2.1 / OIDC)
npx skills add kylrix/kylrix/oauth2

# Autonomous AI Agents
npx skills add kylrix/kylrix/agents
```

---

## 🌐 Endpoints & Environments

- **Production Web App**: [https://www.kylrix.space](https://www.kylrix.space)
- **Production REST API**: `https://www.kylrix.space/api/v1`
- **Native MCP Server**: `https://www.kylrix.space/api/v1/mcp`
- **OAuth 2.1 Discovery**: `https://www.kylrix.space/.well-known/openid-configuration`
- **Local Dev Base**: `http://localhost:3005/api/v1`
