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

## Philosophy

> **Everything is an object, every action is just a tool call, and every result is more context.**

Kylrix treats notes, tasks, events, vault items, chats, files, and even workspaces as the same primitive: **objects** with rows, permissions, and history. Agents don't live in a sidebar — they live in the workspace, calling the same tools you call. Each note you capture, each task you close, each message you send feeds the **Context Engine** (`CompiledLocalContext`) and becomes leverage for the next action. The system compounds.

Local copy is truth. The network confirms. Guests get the same engine. No feature is an island.

---

## How features synergize — not a feature list

**Capture once, use everywhere.** An Idea (note) tagged `source:kylrixnote:id` links a Vault secret, a Flow task, and a Project workspace without join tables. That same link is what search, agents, and cross-workspace filters resolve.

**Ideas → Flow → Workspace → Outcome.** Write in **Ideas**, promote to a **Goal/Task** in Flow, attach to a **Workspace** (`projects` + `project_objects` join), discuss in the **same** `conversations`/`messages` table that powers Connect DMs (no separate comment engine), and let **Kylie** draft the follow-up. The workspace is the synergy hub — not a folder.

**Workspace as callable API.** Every workspace-linked object is reachable via **PAT** (`Authorization: Bearer kylrix_pat_…`) or **Sign in with Kylrix** (Appwrite OAuth2.1/OIDC, JWKS, `grant_id` consent at `/oauth/consent`) on `/api/v1`. Notes, goals, workspaces, events, forms, flows, feeds, moments, threads, chats, tags, vault metadata — same scopes (`notes:read/write`, `goals:read/write`, `flows:read`, `profile:read`) whether you call from CLI, an external agent (`npx skills add kylrix/kylrix/api`), or another device.

**Connect is the tissue.** **Moments** (feed), **Mail**, and **Hangouts** (`conversations`/`messages` with `isEncrypted` transient keys, `false` when locked) share presence (`presence.call.*` + `chat.conversations.*` ephemeral, no DB thrash), typing, and WebRTC. A DM is a one-row conversation; a project thread is the same table with `type:'thread'`. No `notes.isthread` polymorphism — one table, one realtime channel. That unity lets realtime, search, and agent retrieval run one pipeline.

**Vault is not a silo.** Credentials/TOTP are encrypted with **Argon2id 64MB/3it + AES-256-GCM** (WebAuthn PRF, tab-scoped `LOCK_SYSTEM` wipe) in an isolated `sec_enclave_keychain_{userId}` pocket (RxDB only). The same object — `vault → note → task → chat` link — lets an agent reference a secret's *metadata* (never plaintext) while drafting a deployment note, or lets you paste a `[vault:id:name]` chip into a task and resolve it instantly.

**Flow is time + accountability.** Tasks, events, calendars, `focusSessions`, and forms share `kylrixflow` facades and `TaskContext` live-copy. A calendar event creates a workspace thread; a form response spins a discussion hangout; a goal reminder fans out via Telegram/email Workers. All of it writes through **Server Actions** (`createRowSecure` + `withSystemTransaction`) with RLS (`Permission.read(Role.user(id))` + `collaborators` polymorphic + `permission-updater` Function).

**Offline-first compounds trust.** Live copy (React context + RxDB `LocalEngine`) is the UI SoT; pending queue (`kylrix:sync:pending-queue`) is amber/green SoT; Appwrite confirms. `autonomicSyncEngine` coalesces ~450ms, `optimisticEngine` prefetches, `interpolationEngine` resolves (`isPending` wins else newer `$updatedAt`). Soft pull only on focus/visibility. Guests work offline with the same engine; no account, no data loss.

**Calls are pure P2P.** WebRTC (`WebRTCManager`) no longer relies on complex SFU or DB signal tables. Direct P2P connects peers seamlessly with SDP/ICE traveled over ephemeral presence channels (`call.<callId>` via `PresenceService.broadcastState/subscribeToPresence`), free for all users with zero server latency or maintenance overhead.

**Agents read what you already linked.** Kylie buffers the last 30 events into `CompiledLocalContext`, builds a zone-aware prompt, calls Gemini, and dispatches tool calls through the same `client-executor → Server Actions` path. No compute fleet — small, grounded context beats orchestration. Pro-gated, `compute_balances` metered, `agent-action-guardrail` ownership-checked.

**The loop:** object → tool call → context → next object. Ship daily, the system gets smarter.

---

## Quick start

### Self-Hosting

#### Option 1: 1-Command Script
```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

#### Option 2: Docker Direct Pull
```bash
docker pull ghcr.io/kylrix/kylrix:latest
docker run -d -p 3006:3000 --name kylrix-app ghcr.io/kylrix/kylrix:latest
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

## Ota

```bash
ota validate .
ota doctor
ota tasks --use
ota up --workflow verify --mode native
ota up --workflow sqlite-dev
```

See `ota.yaml` (verify, sqlite-dev, selfhost) and `appwrite.config.json`.

## SDK & Extensibility

- **Workflows & Automation:** Build declarative trigger-action routines at `/flows` to automate tasks, form reactions, and cross-object event pipelines.
- **REST & Agentic API:** Integrate via `/api/v1` using Personal Access Tokens (PATs) across notes, goals, workspaces, events, forms, and vault metadata (`npx skills add kylrix/kylrix/api`).
- **Sign in with Kylrix (OAuth 2.1 / OIDC):** Build custom third-party apps and services authenticated directly through Kylrix accounts with granular permission scopes.

## Bug Reports, Feature Requests & Security

Submit bug reports, feature suggestions, or responsible vulnerability disclosures directly through our [Unified Feedback & Security Portal](https://www.kylrix.space/form/6a2a653f002b0f296958). For architecture specs, see `ARCHITECTURE.md`.
