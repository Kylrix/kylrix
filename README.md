<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">Zero-knowledge secrets and persistent memory for AI agents.</h1>

<p align="center">
  <strong>Let Claude Code, Cursor, and local agents use credentials and carry context without ever seeing plaintext secrets.</strong><br>
  <em>Client-side encrypted vault (Argon2id + AES-256-GCM), sovereign SQLite memory, and native MCP bridge.</em>
</p>

<p align="center">
  Open source · Self-hostable · Local-first · Zero plaintext exposure
</p>

<p align="center">
  <a href="LICENSE">AGPL-3.0-or-later</a> ·
  <a href="ARCHITECTURE.md">Architecture</a> ·
  <a href="https://www.kylrix.space">kylrix.space</a> ·
  <a href="https://www.kylrix.space/docs/api">API Docs</a>
</p>

<p align="center">
  <a href="https://smithery.ai/servers/kylrix/kylrix"><img src="https://smithery.ai/badge/kylrix/kylrix" alt="smithery badge"></a>
</p>

## TL;DR
- **The Core Wedge**: AI agents need credentials and past context to do useful work, but pasting raw API keys into agent prompts leaks secrets to LLM providers. Kylrix bridges agents to an Argon2id/AES-256-GCM encrypted vault where credentials are resolved safely, while preserving session memory across restarts.
- **Connect in 10s**: `npx -y @smithery/cli install kylrix/kylrix` (Cursor / Claude Code) or `kylrix mcp` locally.
- **CLI & Local Bridge**: `npm i -g @kylrix/cli` · [CLI Docs](docs/cli.md)
- **Self-Host**: `docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest`
- **Hosted Cloud**: [kylrix.space](https://www.kylrix.space)

---

## 🎁 Contributor Program

**Kylrix Pro is free forever for anyone with a merged pull request in the past 30 days.**

- **Automatic Activation**: Sign in with GitHub on your account. Merged PRs are detected automatically.
- **Perks**: Free Pro tier, high-priority feature request triage (considered directly for [`TODO.md`](TODO.md) / [`ROADMAP.md`](ROADMAP.md)), and the Contributor Crown badge on your public profile (`/u/username`).
- **Start Here**: Pick an issue from [**`TODO.md`**](TODO.md) or see [**`CONTRIBUTING.md`**](CONTRIBUTING.md).

---

## 🚀 Quick Start

Get up and running across your favorite interfaces, ordered from least friction to full self-hosting:

| Surface / Tool | Description | Quick Start Command / Link | Friction |
|---|---|---|---|
| **🔌 MCP Server** | Native tool server for Cursor, Claude Code, Windsurf & AI IDEs | **Cloud:** `npx -y @smithery/cli install kylrix/kylrix`<br>**Local:** `kylrix mcp` | **1 click** (Smithery) / **Instant** (Local) |
| **⚡ CLI & Local Agent Bridge** | Sovereign terminal tool & local agent execution engine | `npm i -g @kylrix/cli` *(100% offline embedded SQLite)* | **Minimal** (Node 18+) |
| **🔐 Sovereign Vault** | Argon2id + AES-256-GCM zero-knowledge agent secrets & keys | [**Explore Vault Architecture**](docs/vault.md) · `kylrix vault unlock` | **Instant** |
| **🌐 Web App** | Local-first workspace with offline storage & browser agents | [**Launch kylrix.space**](https://www.kylrix.space) | **Zero friction** (Instant browser) |
| **🐳 Docker Self-Host** | Sovereign container on port `:5003` | `docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest` | **Instant** (Docker) |
| **📡 REST API** | Programmatic CRUD for ideas, goals, vaults & agents (`/api/v1`) | [**API Documentation (`/docs/api`)**](docs/api.md) · Bearer PAT token | **Low** (Bearer PAT) |

> 💬 *Also included: [Telegram Bot](https://www.kylrix.space/connect/telegram), [Discord Bot](https://www.kylrix.space/connect/discord), and [WebMCP](docs/webmcp.md) browser runner.*

---

## ⚡ CLI & Local Agent Bridge (`@kylrix/cli`)

Install once for sovereign offline local-first execution (powered by embedded SQLite):

```bash
npm install -g @kylrix/cli
```

*(Zero-install alternative: `npx @kylrix/cli <command>`)*

```bash
# 1. Start local stdio MCP server for Cursor / Claude Code / Windsurf
kylrix mcp

# 2. Unlock zero-knowledge encrypted vault & pass secrets to agents without leaks
kylrix vault unlock
kylrix vault get <secret-id> --pure > .env

# 3. Seamlessly auto-connect IDE agents (Claude Code, Cursor, Antigravity) to workspace context
kylrix connect
kylrix connect --client claude --directory ./my-project

# 4. Local-first sovereign memory (embedded SQLite — carries across reboots)
kylrix ideas create "Auth refactor design" --content "Zero-cloud agent memory"
kylrix goals create "Ship agent v1" --target 100 --unit %

# 5. Local agent execution session
kylrix agents start "Audit auth flow" --prompt "Inspect login handlers"

# 6. Synchronize local offline SQLite silo to cloud or self-hosted instance (optional)
kylrix sync
kylrix login --url http://localhost:5003
```

> 📖 See [**`docs/cli.md`**](docs/cli.md) for the complete command reference and SDK documentation.

---

## Humans & agents

Humans and agents share the same workspace. MCP for IDE tool loops; REST for scripts, mobile, and CI.

**Choose auth**

| Token | Use when |
|---|---|
| **PAT** (`kyl_pat_…`) | The agent acts in **your** workspace (IDE tools, scripts, MCP on your behalf). [Settings → Developers](https://www.kylrix.space/settings?tab=developers) |
| **Agent key** (`kyl_apk_…`) | The agent gets **its own** workspace — it provisions itself and mints its own PAT. [Settings → Smart Agents](https://www.kylrix.space/settings?tab=agents) |

| Surface | Use when |
|---|---|
| **WebMCP** (`navigator.modelContext`) | In-browser agents (Chrome, ChatGPT browser) with zero-config live session tools |
| **MCP** | IDE agents (Cursor, Claude, Windsurf, Codex, …) |
| **REST API** (`/api/v1`) | Scripts, mobile apps, CI, custom backends |

**Steps**

1. **Mint a token** — [PAT](https://www.kylrix.space/settings?tab=developers) (your workspace) or [agent key](https://www.kylrix.space/settings?tab=agents) (agent workspace)
2. **Install skills**
   ```bash
   npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
   ```
3. **Connect MCP** (IDE only — uses your PAT; Smithery wires the official endpoint interactively for your IDE)
   ```bash
   npx -y @smithery/cli install kylrix/kylrix
   # or specify directly: --client cursor / --client claude / --client windsurf
   ```

### In-Browser Agent Bridge (WebMCP)

Expose workspace memory directly to browser-driven AI agents (e.g., ChatGPT browser runner, Chrome AI) via standard `navigator.modelContext` without browser extensions:

```javascript
await navigator.modelContext.executeTool('kylrix_create_note', {
  title: 'Agent Note',
  content: 'Created via in-browser modelContext',
  tags: ['webmcp']
});
```

*Test:* Enable `chrome://flags/#enable-webmcp-testing` in Chrome, browse via ChatGPT, or click the **WebMCP** badge in [Settings → Developers](https://www.kylrix.space/settings?tab=developers).

Wiring reference: [docs/integrations.md](docs/integrations.md) · [docs/webmcp.md](docs/webmcp.md)

---

## Self-host

Run a fully sovereign Kylrix instance on your own infrastructure:

```bash
# 1-Command Docker Run (Instant from GHCR)
docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest
```

Or run via Docker Compose:

```bash
# Clone and launch
git clone https://github.com/Kylrix/kylrix.git && cd kylrix
docker compose up -d
```

| Component | Default Endpoint | Mode |
|---|---|---|
| **Kylrix App** | `http://localhost:5003` | Standalone Local-First & SQLite / Turso (`BACKEND=false`) |
| **Integrated Backend** | `http://localhost:8080/v1` | Optional container stack (`BACKEND=true` via `./selfhost.sh --with-backend`) |

> 📖 See [**`SELFHOST.md`**](SELFHOST.md) for environment variables, multi-container compose stacks, and backup procedures.

---

## Develop

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
cp env.sample .env
```

**Install Ota** (execution contract for this repo):

```bash
curl -fsSL https://dist.ota.run/install.sh | sh
```

**Run:**

```bash
ota doctor
ota up --workflow dev          # local app → http://localhost:3005
ota up --workflow verify       # lint + test + build
```

Contract: `ota.yaml` · schema: `appwrite.config.json`

---

## Integrations

| | Link |
|---|---|
| **WebMCP** (W3C in-browser) | [docs/webmcp.md](docs/webmcp.md) · `navigator.modelContext` |
| **MCP** | [Humans & agents](#humans--agents) above · [docs/mcp.md](docs/mcp.md) |
| **REST API** | [docs/api.md](docs/api.md) · `https://www.kylrix.space/api/v1` |
| **Sign in with Kylrix** (OAuth 2.1) | [docs/oauth2.md](docs/oauth2.md) |
| **SDK** | [`sdk/`](sdk/) in this repo |
| **Flows** | Extensible layers inside Kylrix — [kylrix.space/flows](https://www.kylrix.space/flows) |

---

## What ships in the box

| Area | What |
|---|---|
| **Notes & ideas** | Linked notes, tags, sharing |
| **Goals** | Goal tracking and focus sessions |
| **Forms** | Structured data and input collection |
| **Flows** | Installable workflow plugins ([kylrix.space/flows](https://www.kylrix.space/flows)) |
| **Workspaces** | Projects, collaborators, permissions |
| **Agent Inbox** | Inbound agent logs, messages, and collaborative sessions |
| **Vault** | Client-encrypted credentials (optional) |
| **Agents** | In-workspace sessions with tool parity to users |

Local copy is the default source of truth; sync confirms in the background.

---

## 📱 Mobile, Desktop & Custom Clients

You can build custom mobile apps (iOS/Android), desktop wrappers (Tauri/Electron), or menu bar companions for Kylrix.

### Recommendations:
- **Personal Tools & Wrappers:** Mint a [Personal Access Token (PAT)](https://www.kylrix.space/settings?tab=developers) to connect directly to the [HTTP REST API (`/api/v1`)](https://www.kylrix.space/docs/api) or isomorphic SDK.
- **Distributed / Third-Party Apps:** Register an [OAuth 2.1 Client](https://www.kylrix.space/settings?tab=developers) with PKCE flow so users can authorize your app securely without exposing private credentials. Review [TRADEMARK.md](TRADEMARK.md) for brand and naming guidelines.

---

## 💳 Pricing

Kylrix is local-first, self-hostable, and open source under AGPLv3. Cloud sync, multi-agent workspaces, and encrypted cloud backups are available on hosted tiers:

| Tier | Price | Highlights | Target Audience |
|---|---|---|---|
| **Community / Self-Host** | **Free forever** | 100% offline local SQLite, zero-knowledge vault, local MCP server, unlimited local ideas & goals | Solo developers, hackers, self-hosters |
| **Contributor** | **Free Pro forever** | Automatically unlocked with any merged PR to Kylrix within the last 30 days | Open-source contributors |
| **Pro** | **$10 / month** | Encrypted cloud sync across machines, zero-leak cloud vault backup, AI sidekick & agent execution, audio notes, priority support | Developers using Cursor / Claude Code daily |
| **Teams** | **$50 / month** | Shared team workspaces, nested projects, higher API & MCP rate limits, group channels | Teams coordinating multi-agent workflows |

---

## ❤️ Sponsor & Back Development

Kylrix is an independently bootstrapped, open-source engineering ecosystem built for decade-scale durability. Maintaining core runtimes, offline-first sync engines, zero-knowledge vault primitives, and sovereign agent toolchains requires continuous development and dedicated engineering bandwidth.

If Kylrix powers your daily workflow or team infrastructure, consider sponsoring development to accelerate roadmap velocity and sustain active maintenance.

<p align="center">
  <a href="https://www.kylrix.space/sponsor" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Sponsor_Kylrix-%E2%9D%A4-EC4899?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor Kylrix" />
  </a>
</p>

---

## Feedback & security

[Bug report form](https://www.kylrix.space/form/6aae3dab003a7247b90a) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TRADEMARK.md](TRADEMARK.md)
