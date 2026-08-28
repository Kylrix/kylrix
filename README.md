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
  <a href="https://www.kylrix.space/docs/api">API Docs</a>
</p>

<p align="center">
  <a href="https://smithery.ai/servers/kylrix/kylrix"><img src="https://smithery.ai/badge/kylrix/kylrix" alt="smithery badge"></a>
</p>

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

- **Workflows & Automation:** Build declarative trigger-action routines at `/flows` to automate tasks, form reactions, and cross-object event pipelines.
- **REST & Agentic API:** Integrate via `/api/v1` using Personal Access Tokens (PATs) across notes, goals, workspaces, events, forms, and vault metadata (`npx skills add kylrix/kylrix/api`).
- **Sign in with Kylrix (OAuth 2.1 / OIDC):** Build custom third-party apps and services authenticated directly through Kylrix accounts with granular permission scopes.

## Bug Reports, Feature Requests & Security

Submit bug reports, feature suggestions, or responsible vulnerability disclosures directly through our [Unified Feedback & Security Portal](https://www.kylrix.space/form/6a2a653f002b0f296958). For architecture specs, see `ARCHITECTURE.md`.
