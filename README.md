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
  <a href="https://discord.gg/YjF5yCBCmx" target="_blank"><img src="https://img.shields.io/badge/Discord_Community-Join_Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join Discord Community" /></a>
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

## 🔐 Zero-Knowledge Secrets & Persistent Agent Memory

Kylrix establishes true zero-knowledge secret access and persistent memory for AI agents (Claude Code, Cursor, AutoGPT, CLI, VS Code, REST API, WebMCP, Discord/Telegram).

### How Agent Enclave Tokens (AET) Work
An agent key looks like `kyl_aet_<8 hex>_<32 b64url>.etk_<64 hex>`. Only the part left of the dot ever reaches the server (it is hashed and used as the bearer credential); `etk_…` is a 32-byte unlock key that stays on your machine.

1. **Client-Side DEK Wrapping**: In **Settings → Developers → Create Token**, enable "Agent key with access to private items". The browser asks you to unlock your vault (MEK/Passkey PRF), generates the `etkSecret`, and re-wraps the DEKs of your chosen vault items and 2FA codes under an HKDF-SHA256 wrapping key (AES-256-GCM, per-entry AAD bound to the row id).
2. **Envelope Storage**: The server stores only the wrapped-DEK envelope in `apikey.metadata.aet` — it **never possesses the MEK or the `etkSecret`**, and the envelope is hidden from all public token listings.
3. **Two Unlock Modes**:
   - *Client-side (default, zero-knowledge)*: the CLI/VS Code fetch the envelope via `GET /api/v1/token/enclave` plus sealed ciphertext via `?sealed=1` reads, and unlock locally.
   - *Server-assisted (opt-in)*: send the full key in the `X-Kylrix-Agent-Token` header over https and the server decrypts granted rows in-memory for one request. Convenient, but no longer zero-knowledge — use only if you trust the server.
4. **RAM Hygiene**: Unlock keys live as zeroable `Uint8Array` buffers that are cleared after use. Decrypted field values are JS strings and cannot be wiped — references are dropped, which is an honest platform limitation.

### Quick Start Examples

#### Claude Code / Cursor
```bash
export KYLRIX_AGENT_KEY="kyl_aet_a1b2c3d4_XXXX.etk_7f8a9b..."
kylrix agents connect --claude-code   # or --cursor, or --check to verify only
```

#### CLI Exec
Inject granted secrets transiently into a child process without leaving traces on disk:
```bash
kylrix exec --token kyl_aet_... -- "npm start"   # a specific item: kylrix exec <id> -- npm start
```

#### WebMCP & REST API
```bash
curl -X GET "https://www.kylrix.space/api/v1/vault/secret-id" \
  -H "X-Kylrix-Agent-Token: kyl_aet_..."
```

---

## ⚡ Quick Connect

| Surface | Action / Command |
|---|---|
| **🌐 Web App** | [Launch kylrix.space](https://www.kylrix.space) |
| **💬 Discord Community** | [Join Discord Server](https://discord.gg/YjF5yCBCmx) |
| **💻 CLI Tool** | `npm i -g @kylrix/cli` |
| **🔌 MCP Server** | `npx -y @smithery/cli install kylrix/kylrix` |
| **⚡ Local MCP** | `kylrix mcp` |
| **📡 REST API** | [API Reference (`docs/api.md`)](docs/api.md) |
| **🧩 VS Code Extension** | [Install VS Code Extension](https://marketplace.visualstudio.com/items?itemName=nathfavour.kylrix-vscode&ssr=false#review-details) |
| **👾 Discord Bot** | [Connect Discord](https://www.kylrix.space/connect/discord) |
| **✈️ Telegram Bot** | [Connect Telegram](https://www.kylrix.space/connect/telegram) |
| **💬 Slack Bot** | *Coming Soon* |
| **🌐 WebMCP** | [WebMCP Documentation](docs/webmcp.md) |
| **🐳 Docker** | `docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest` |

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
| **Discord Community** | [Join Discord Server](https://discord.gg/YjF5yCBCmx) |
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
