<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">The sovereign workspace for developers who run local AI agents.</h1>

<p align="center">
  <strong>Your projects, secrets, and agents stay connected—so every session builds on the last.</strong><br>
  <em>Zero-leak vault, local notes, and native MCP bridge for Cursor and Claude Code.</em>
</p>

<p align="center">
  Open source · Self-hostable · Local-first · Argon2id + AES-256-GCM
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

- **Kylrix** — open-source, local-first workspace for notes, goals, workspaces, agent inbox, vault, and agents.
- **CLI & MCP Bridge** — `npm i -g @kylrix/cli` · [CLI Docs](docs/cli.md)
- **Use the cloud** — [kylrix.space](https://www.kylrix.space)
- **Self-host** — `curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash` → app on `:5003`
- **Wire an agent** — mint a [PAT](https://www.kylrix.space/settings?tab=developers) (your workspace) or [agent key](https://www.kylrix.space/settings?tab=agents) (the agent's own workspace), then `npx skills add kylrix/kylrix --skill mcp --skill api --skill agents`

---

## 🎁 Contributor Program (Kylrix Pro Free Forever)

**Kylrix Pro is free forever for developers who contribute to Kylrix**, as long as you have at least one merged pull request in the codebase in the past 30 days.

- **100% Automated**: Sign in with GitHub on [kylrix.space](https://www.kylrix.space)—our verification engine automatically traces merged PRs on `Kylrix/kylrix` in the last 30 days and upgrades your account with zero manual review.
- **What to Build**: Pick from prioritized pain points in [**`TODO.md`**](TODO.md) or explore systemic architectural pillars in [**`ROADMAP.md`**](ROADMAP.md).
- **Guidelines**: Read [**`CONTRIBUTING.md`**](CONTRIBUTING.md) to get started.

---

## 🚀 Quick Start

Get up and running across your favorite interfaces, ordered from least friction to full self-hosting:

| Platform / Client | Description | Quick Start Command / Link | Friction |
|---|---|---|---|
| **🌐 Web App** | Zero-install local-first workspace with offline storage | [**Launch kylrix.space**](https://www.kylrix.space) | **Zero friction** (Instant browser) |
| **🤖 WebMCP** | W3C Model Context Protocol in browser for visiting AI agents | [**Explore WebMCP**](docs/webmcp.md) · Enable `chrome://flags/#enable-webmcp-testing` | **Zero friction** (In-session) |
| **💬 Telegram Bot** | Instant alerts, idea capture, goal tracking & search in Telegram | [**1-Click Connect Telegram**](https://www.kylrix.space/connect/telegram) | **1 click** (Deep link) |
| **🎮 Discord Bot** | Interactive server bot (`/ideas`, `/goals`, `/search`, `/pair`) | [**Install Discord Bot**](https://www.kylrix.space/connect/discord) | **1 click** (Server invite) |
| **⚡ CLI & Local Bridge** | Sovereign terminal tool & local agent execution engine | `npm i -g @kylrix/cli` *(100% offline & local)* | **Minimal** (Node 18+) |
| **📡 REST API** | Programmatic CRUD for ideas, goals, vaults & agents (`/api/v1`) | [**Modular Samples (`samples/REST/`)**](samples/REST/) · `python3 samples/REST/create_idea.py` or `./samples/REST/create_idea.sh` | **Low** (Bearer PAT) |
| **🔌 MCP Server** | Native tool server for Cursor, Claude, Windsurf & AI IDEs | **Cloud:** `npx -y @smithery/cli install kylrix/kylrix`<br>**Local:** `kylrix mcp` | **1 click** (Smithery) / **Instant** (Local) |
| **🔐 Sign in with Kylrix** | OAuth 2.1 / OIDC identity provider with PKCE | [Discovery Doc](https://www.kylrix.space/.well-known/openid-configuration) · [OAuth Guide](.agents/skills/oauth2/SKILL.md) | **Standard** (OAuth 2.1) |
| **🔄 Self-Hosted Sync** | Bi-directional replication between private nodes and Cloud | [**Settings → Cloud Sync**](https://www.kylrix.space/settings?tab=sync#cloud-sync) | **Low** (1-click punch) |
| **🐳 Docker Self-Host** | Bundled bare-metal container stack on port `:5003` | `curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh \| bash` | **Moderate** (Docker) |

---

## ⚡ CLI & Local Agent Bridge (`@kylrix/cli`)

Install once for sovereign offline local-first execution (powered by embedded SQLite):

```bash
npm install -g @kylrix/cli
```

*(Zero-install alternative: `npx @kylrix/cli <command>`)*

```bash
# 1. Start local stdio MCP server for Cursor / Claude / Windsurf
kylrix mcp

# 2. Create and list local sovereign ideas (offline embedded SQLite)
kylrix ideas create "Local Agent Idea" --content "Zero-cloud memory"
kylrix ideas list

# 3. Track personal and project goals
kylrix goals create "Ship MVP" --target 100 --unit %
kylrix goals list

# 4. Unlock zero-knowledge encrypted vault and extract secrets (.env)
kylrix vault unlock
kylrix vault get <secret-id> --pure > .env

# 5. Generate live 2FA TOTP authentication codes
kylrix totp list
kylrix totp code <id>

# 6. Global search across local ideas, goals, events, and secrets
kylrix search "agent"

# 7. Start autonomous local AI agent session
kylrix agents start "Refactor auth" --prompt "Audit login flows"

# 8. Autonomously detect and connect coding tools (Claude, Cursor, Antigravity, Kiro) & synthesize context
kylrix connect
kylrix connect --client claude --directory ./my-project
kylrix connect-status

# 9. Synchronize local offline SQLite silo to cloud/self-hosted workspace
kylrix sync

# 10. Connect/pair with cloud or self-hosted instance (optional)
kylrix login
kylrix login --url http://localhost:3005
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

**Agent skill:**

```bash
npx skills add kylrix/kylrix --skill selfhost
```

**Configure** (optional — omit to auto-mint admin credentials into `.env`):

```bash
export SELFHOST_ADMIN_EMAIL=you@example.com
export SELFHOST_ADMIN_PASSWORD='your-secure-password'
```

**Install** (bundled Appwrite + Kylrix, no cloud backend):

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

| | Default |
|---|---|
| App | `http://localhost:5003` |
| Appwrite API | `http://localhost:8080/v1` |

More: [SELFHOST.md](SELFHOST.md) · re-run `./selfhost.sh` anytime (detects drift, skips healthy steps).

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

[Bug report form](https://www.kylrix.space/form/6a2a653f002b0f296958) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TRADEMARK.md](TRADEMARK.md)
