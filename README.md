<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">Build, ship and think in one living agentic workspace.</h1>

<p align="center">
  <strong>Your workflow becomes a living, scalable system that compounds daily leverage over time.</strong>
</p>

<p align="center">
  Open source · Self-hostable · Local-first · Optional encryption
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

---

## Sponsor

<p align="center">
  <a href="https://www.kylrix.space/sponsor" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-EC4899?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor" />
  </a>
</p>

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

## Humans & agents

Humans and agents share the same workspace. MCP for IDE tool loops; REST for scripts, mobile, and CI.

**Choose auth**

| Token | Use when |
|---|---|
| **PAT** (`kyl_pat_…`) | The agent acts in **your** workspace (IDE tools, scripts, MCP on your behalf). [Settings → Developers](https://www.kylrix.space/settings?tab=developers) |
| **Agent key** (`kyl_apk_…`) | The agent gets **its own** workspace — it provisions itself and mints its own PAT. [Settings → Smart Agents](https://www.kylrix.space/settings?tab=agents) |

| Surface | Use when |
|---|---|
| **MCP** | IDE agents (Cursor, Claude, Windsurf, Codex, …) |
| **REST API** (`/api/v1`) | Scripts, mobile apps, CI, custom backends |

**Steps**

1. **Mint a token** — [PAT](https://www.kylrix.space/settings?tab=developers) (your workspace) or [agent key](https://www.kylrix.space/settings?tab=agents) (agent workspace)
2. **Install skills**
   ```bash
   npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
   ```
3. **Connect MCP** (IDE only — uses your PAT; Smithery wires the official endpoint)
   ```bash
   npx -y @smithery/cli install kylrix/kylrix --client cursor
   ```

Wiring reference: [docs/integrations.md](docs/integrations.md)

---

## Integrations

| | Link |
|---|---|
| **MCP** | [Humans & agents](#humans--agents) above |
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
| **Events** | Calendar and scheduling |
| **Forms** | Build forms and collect responses |
| **Flows** | Installable workflow plugins ([kylrix.space/flows](https://www.kylrix.space/flows)) |
| **Workspaces** | Projects, collaborators, permissions |
| **Connect** | Chats, moments, group hangouts |
| **Vault** | Client-encrypted credentials (optional) |
| **Agents** | In-workspace sessions with tool parity to users |

Local copy is the default source of truth; sync confirms in the background.

---

## Feedback & security

[Bug report form](https://www.kylrix.space/form/6a2a653f002b0f296958) · [ARCHITECTURE.md](ARCHITECTURE.md)
