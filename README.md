<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">Build, ship and think in one living agentic workspace.</h1>

<p align="center">
  <strong>Your workflow becomes a living, scalable system that compounds daily leverage over time.</strong>
</p>

<p align="center">
  Open source · Self-hostable · Single-database · Local-first · E2EE optional
</p>

<p align="center">
  <a href="LICENSE">AGPL-3.0-or-later</a> ·
  <a href="ARCHITECTURE.md">Architecture</a> ·
  <a href="https://www.kylrix.space">kylrix.space</a> ·
  <a href="https://www.kylrix.space/sponsor">Sponsor</a> ·
  <a href="https://www.kylrix.space/docs/api">API Docs</a>
</p>

<p align="center">
  <a href="https://smithery.ai/servers/kylrix/kylrix"><img src="https://smithery.ai/badge/kylrix/kylrix" alt="smithery badge"></a>
  <a href="https://www.kylrix.space/sponsor"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-EC4899?style=flat&logo=githubsponsors&logoColor=white" alt="Sponsor Kylrix"></a>
</p>

---

## Sponsor & Support

Support sovereign local-first software, zero-trust cryptographic research, and native Model Context Protocol (MCP) agent tooling.

<p align="center">
  <a href="https://www.kylrix.space/sponsor" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Sponsor_Kylrix-%E2%9D%A4-EC4899?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor Kylrix" />
  </a>
</p>

Sponsorships feature instant Lightning & Nostr Zaps, multi-chain crypto checkout (BlockBee), and on-profile Sovereign Badges.

---

## Quick Start & Setup

### Self-Hosting

#### Option 1: 1-Command Script
```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

#### Option 2: Docker Direct Pull
```bash
docker pull ghcr.io/kylrix/kylrix:latest
docker run -d -p 5003:3000 --name kylrix-app ghcr.io/kylrix/kylrix:latest
```

#### Option 3: Docker Compose
```bash
docker compose up -d
```

### Local Development

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
cp .env.example .env
pnpm install
pnpm dev
```

Open **http://localhost:3005**.

### Ota Contributor Workflow

```bash
ota validate .
ota doctor
ota tasks --use
ota up --workflow verify --mode native
ota up --workflow dev
```

See `ota.yaml` (verify, dev, selfhost) and `appwrite.config.json`.

---

## Philosophy

> **Everything is an object, every action is just a tool call, and every result is more context.**

Kylrix treats notes, tasks, events, vault items, chats, files, and even workspaces as the same primitive: **objects** with rows, permissions, and history. Agents don't live in a sidebar — they live in the workspace, calling the same tools you call. Each note you capture, each task you close, each message you send feeds the **Context Engine** (`CompiledLocalContext`) and becomes leverage for the next action. The system compounds.

Local copy is truth. The network confirms. Guests get the same engine. No feature is an island.

---

## Integrations & MCP Installation

Connect any AI client, CLI, or autonomous agent directly to Kylrix via the Model Context Protocol (MCP) and official Agent Skills.

### 1. Agent Skills Installation

Add domain-specific capabilities directly to your coding assistant or CLI:

```bash
# Kylrix MCP Server Skill
npx skills add kylrix/kylrix/mcp

# Kylrix REST API (PAT) Skill
npx skills add kylrix/kylrix/api

# Autonomous Agents Runtime Skill
npx skills add kylrix/kylrix/agents
```

### 2. Installing Kylrix MCP into Different Tools

The Kylrix MCP server runs over Streamable HTTP and SSE at `https://www.kylrix.space/api/v1/mcp` (or `http://localhost:5003/api/v1/mcp` when self-hosting).

#### Claude Code
```bash
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"
```

#### Smithery CLI (Automated 1-Command Install)
```bash
# Claude Desktop
npx -y @smithery/cli install kylrix/kylrix --client claude

# Cursor
npx -y @smithery/cli install kylrix/kylrix --client cursor

# Windsurf
npx -y @smithery/cli install kylrix/kylrix --client windsurf
```

#### Cursor (`.cursor/mcp.json` or Settings > Features > MCP)
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

#### Claude Desktop (`claude_desktop_config.json`)
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

#### Windsurf, Goose, Cline & Continue
Configure an HTTP or SSE MCP server pointing to the instance endpoint:
- **Server URL**: `https://www.kylrix.space/api/v1/mcp` (or `http://localhost:5003/api/v1/mcp`)
- **Transport**: `http` (or `sse` via `/api/v1/mcp?transport=sse`)
- **Header**: `Authorization: Bearer <YOUR_PAT_TOKEN>` (create tokens in **Settings > Developers**)

---

## The Unified System

Kylrix replaces disconnected point apps with a compounding graph where notes, tasks, credentials, calendar events, and discussions share the same underlying object primitives. An action in one domain immediately enriches context for search, real-time collaboration, and autonomous agents.

Local state serves as the immediate source of truth with background confirmation, while agents and external integrations leverage identical tool calls through the REST and MCP interfaces.

| Domain | Core Primitive | Cross-System Synergy |
|---|---|---|
| **Ideas & Notes** | `notes` | Captures knowledge that cross-links directly with vault secrets, tasks, and project workspaces without join tables. |
| **Flow & Tasks** | `goals`, `events` | Promotes ideas to structured goals, calendar events, focus sessions, and automated workflow triggers. |
| **Workspaces** | `projects` | Unifies objects, collaborator permissions, and context into a single addressable API surface. |
| **Connect & DMs** | `conversations`, `messages` | Powers project threads, DMs, presence, and peer-to-peer WebRTC calls over a single channel architecture. |
| **Vault & Security** | `sec_enclave_*` | Client-encrypted (Argon2id + AES-256-GCM) enclave exposing safe metadata chips without exposing secrets. |
| **Agents & Context** | `CompiledLocalContext` | In-workspace intelligence operating directly on recent context with 1:1 parity to user tool calls. |

---

## SDK & Extensibility

Kylrix is intentionally engineered as a single, sovereign web codebase to maintain unmatched iteration velocity and zero multi-repo divergence. As a design principle, first-party mobile, desktop, or CLI client apps are not shipped in core; instead, Kylrix provides comprehensive protocols, standard APIs, and developer tooling so third-party developers, agents, and community builders can build custom native clients, CLI tools, scripts, and ecosystem integrations.

Comprehensive documentation for all interfaces is available in the [Kylrix Docs](https://github.com/Kylrix/kylrix/tree/master/docs).

| What You Want to Build | System / Protocol | Developer Capabilities | Documentation |
|---|---|---|---|
| **AI Assistants & LLM Workflows** | Model Context Protocol (MCP) | Streamable HTTP & SSE MCP server at `/api/v1/mcp` with 1:1 tool parity across notes, goals, workspaces, events, forms, flows, and vault metadata. | [docs/mcp.md](https://github.com/Kylrix/kylrix/blob/master/docs/mcp.md) |
| **Custom Clients, Mobile Apps & CLI** | REST API (`/api/v1`) | Scoped Personal Access Tokens (PATs) with Bearer auth for complete CRUD, cross-object filtering, and workspace operations (`npx skills add kylrix/kylrix/api`). | [docs/api.md](https://github.com/Kylrix/kylrix/blob/master/docs/api.md) |
| **Third-Party App Authentication** | Sign in with Kylrix (OAuth 2.1 / OIDC) | Authorization Code flow with PKCE, consent management (`/oauth/consent`), JWKS validation, and granular user scopes. | [docs/oauth2.md](https://github.com/Kylrix/kylrix/blob/master/docs/oauth2.md) |
| **Autonomous Workspace Agents** | Agentic Runtime & Provisioning | Zero-trust Agent Provisioning Keys, sovereign EVM/Nostr agent identities, and sandboxed workspace memory execution. | [docs/agents.md](https://github.com/Kylrix/kylrix/blob/master/docs/agents.md) |
| **Cross-Object Reactive Automations** | Flows & Event Engine | Declarative trigger-action routines at `/flows` to automate task lifecycles, webhook reactions, and cross-table event pipelines. | [docs/api.md](https://github.com/Kylrix/kylrix/blob/master/docs/api.md) |

---

## Bug Reports, Feature Requests & Security

Submit bug reports, feature suggestions, or responsible vulnerability disclosures directly through our [Unified Feedback & Security Portal](https://www.kylrix.space/form/6a2a653f002b0f296958). For architecture specs, see `ARCHITECTURE.md`.
