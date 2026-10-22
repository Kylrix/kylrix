<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">Zero-knowledge secrets & sovereign memory for AI agents</h1>

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
  <a href="docs/api.md">API Docs</a>
</p>

<!-- Instant Action Banners -->
<p align="center">
  <a href="https://www.kylrix.space" target="_blank"><img src="https://img.shields.io/badge/Web_App-Launch_Live-EC4899?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web App" /></a>
  <a href="#-cli--local-agent-bridge-kylrixcli"><img src="https://img.shields.io/badge/CLI-Install_&_Run-4F46E5?style=for-the-badge&logo=gnome-terminal&logoColor=white" alt="CLI" /></a>
  <a href="#-mcp-server"><img src="https://img.shields.io/badge/MCP_Server-Connect-8B5CF6?style=for-the-badge&logo=anthropic&logoColor=white" alt="MCP" /></a>
  <a href="docs/api.md"><img src="https://img.shields.io/badge/REST_API-Docs-10B981?style=for-the-badge&logo=fastapi&logoColor=white" alt="REST API" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nathfavour.kylrix-vscode&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/VS_Code_Extension-Install-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code Extension" /></a>
  <a href="https://www.kylrix.space/connect/discord" target="_blank"><img src="https://img.shields.io/badge/Discord_Bot-Connect-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Bot" /></a>
  <a href="https://www.kylrix.space/connect/telegram" target="_blank"><img src="https://img.shields.io/badge/Telegram_Bot-Connect-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Bot" /></a>
  <img src="https://img.shields.io/badge/Slack_Bot-Coming_Soon-4A154B?style=for-the-badge&logo=slack&logoColor=white" alt="Slack Bot" />
  <a href="#in-browser-agent-bridge-webmcp"><img src="https://img.shields.io/badge/WebMCP-Browser_Bridge-F59E0B?style=for-the-badge&logo=w3c&logoColor=white" alt="WebMCP" /></a>
</p>

---

## ⚡ Quick Connect

| Surface | Action / Command |
|---|---|
| **🔌 MCP Server** | `npx -y @smithery/cli install kylrix/kylrix` |
| **⚡ Local MCP** | `kylrix mcp` |
| **💻 CLI Tool** | `npm i -g @kylrix/cli` |
| **🌐 Web App** | [Launch kylrix.space](https://www.kylrix.space) |
| **🐳 Docker** | `docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest` |
| **📡 REST API** | [API Reference (`docs/api.md`)](docs/api.md) |

---

## 🎁 Contributor Program

**Kylrix Pro is free forever for anyone with a merged pull request in the past 30 days.**

- **Automatic Activation**: Sign in with GitHub. Merged PRs unlock Pro automatically.
- **Perks**: Free Pro tier, high-priority triage on [`TODO.md`](TODO.md) / [`ROADMAP.md`](ROADMAP.md), and Contributor badge (`/u/username`).
- **Start Here**: Read [**`CONTRIBUTING.md`**](CONTRIBUTING.md) and pick an issue or open a PR.

---

## ⚡ CLI & Local Agent Bridge (`@kylrix/cli`)

Install once for sovereign offline local-first execution (embedded SQLite):

```bash
npm install -g @kylrix/cli
```

### Essential Commands

Start local stdio MCP server for Cursor / Claude Code / Windsurf:
```bash
kylrix mcp
```

Unlock zero-knowledge vault & inject secrets safely:
```bash
kylrix vault unlock
```

```bash
kylrix vault get <secret-id> --pure > .env
```

Auto-connect IDE agents:
```bash
kylrix connect
```

```bash
kylrix connect --client claude --directory ./my-project
```

Create sovereign local memory (embedded SQLite):
```bash
kylrix ideas create "Auth refactor design" --content "Zero-cloud agent memory"
```

```bash
kylrix goals create "Ship agent v1" --target 100 --unit %
```

Local agent execution session:
```bash
kylrix agents start "Audit auth flow" --prompt "Inspect login handlers"
```

Sync local offline SQLite silo to cloud or self-hosted server:
```bash
kylrix sync
```

```bash
kylrix login --url http://localhost:5003
```

> 📖 See [**`docs/cli.md`**](docs/cli.md) for full CLI docs.

---

## 🔌 MCP Server

Connect IDE agents (Cursor, Claude Code, Windsurf) in 1 click:

```bash
npx -y @smithery/cli install kylrix/kylrix
```

Or install skills directly:

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

### In-Browser Agent Bridge (WebMCP)

Expose workspace memory directly to browser-driven AI agents (ChatGPT, Chrome AI) via `navigator.modelContext`:

```javascript
await navigator.modelContext.executeTool('kylrix_create_idea', { title: 'Agent Idea', content: 'In-browser modelContext', tags: ['webmcp'] });
```

Wiring reference: [docs/webmcp.md](docs/webmcp.md)

---

## 🐳 Self-Host

Run a sovereign Kylrix instance on port `:5003`:

```bash
docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest
```

Or via Docker Compose:

```bash
git clone https://github.com/Kylrix/kylrix.git && cd kylrix
```

```bash
docker compose up -d
```

> 📖 See [**`SELFHOST.md`**](SELFHOST.md) for multi-container compose & backups.

---

## 🛠️ Develop

Clone & setup:
```bash
git clone https://github.com/Kylrix/kylrix.git
```

```bash
cd kylrix
```

```bash
cp env.sample .env
```

Install Ota execution contract:
```bash
curl -fsSL https://dist.ota.run/install.sh | sh
```

Run development server:
```bash
ota doctor
```

```bash
ota up --workflow dev
```

Run lint, tests & verification:
```bash
ota up --workflow verify
```

---

## 🔗 Integrations & Bots

| Integration | Link |
|---|---|
| **VS Code Extension** | [`packages/vscode`](packages/vscode) · [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=nathfavour.kylrix-vscode&ssr=false#review-details) |
| **Telegram Bot** | [Connect Telegram](https://www.kylrix.space/connect/telegram) |
| **Discord Bot** | [Connect Discord](https://www.kylrix.space/connect/discord) |
| **Slack Bot** | *Coming Soon* |
| **WebMCP** | [docs/webmcp.md](docs/webmcp.md) |
| **REST API** | [docs/api.md](docs/api.md) |

---

## 📦 Features at a Glance

| Module | Purpose |
|---|---|
| **Ideas** | Persistent memory, tags, linked objects |
| **Goals** | Milestones, target metrics & focus tracking |
| **Forms** | Structured data schemas & inputs |
| **Vault** | Client-encrypted zero-knowledge credentials (Argon2id + AES-256-GCM) |
| **Workspaces** | Multi-agent coordination, permissions & collaborator sharing |
| **Agent Inbox** | Agent logs, messaging & collaborative sessions |

---

## 💳 Pricing

| Tier | Price | Highlights |
|---|---|---|
| **Community** | **Free** | 100% offline local SQLite, zero-knowledge vault, local MCP server, unlimited ideas & goals |
| **Contributor** | **Free Pro** | Automatically unlocked with any merged PR in the last 30 days |
| **Pro** | **$10/mo** | Encrypted cloud sync, cloud vault backup, AI sidekick & agent execution |
| **Teams** | **$50/mo** | Multi-agent shared team workspaces, higher rate limits, group channels |

---

## ❤️ Sponsor & Security

<p align="center">
  <a href="https://www.kylrix.space/sponsor" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Sponsor_Kylrix-%E2%9D%A4-EC4899?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor Kylrix" />
  </a>
</p>

[Bug Reports](https://www.kylrix.space/form/6aae3dab003a7247b90a) · [Architecture](ARCHITECTURE.md) · [Trademark](TRADEMARK.md)
