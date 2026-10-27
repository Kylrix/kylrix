# Kylrix System Architecture

This document provides a comprehensive overview of the Kylrix platform architecture, detailing system components, data flow, execution models, and local-first state synchronization topologies.

---

## 🏗️ High-Level System Architecture

Kylrix is designed as an agent-native, local-first workspace platform built with a Next.js 15 App Router server, distributed edge persistence (Turso SQLite / Drizzle ORM), real-time WebSocket orchestration (PartyKit), and multi-interface agent connectivity (MCP, REST API, WebMCP, CLI, VS Code Extension).

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT SURFACES                                   |
|                                                                                   |
|   +--------------------+  +-------------------+  +----------------------------+   |
|   | Next.js Web App    |  | @kylrix/cli       |  | VS Code Extension          |   |
|   | (Browser React)    |  | (Local Node.js)   |  | (packages/vscode)          |   |
|   +---------+----------+  +---------+---------+  +-------------+--------------+   |
|             |                       |                          |                  |
|             | WebMCP / LocalEngine  | Stdio / SQLite           | Direct IPC / SDK |
|             v                       v                          v                  |
+-----------------------------------------------------------------------------------+
                                      |
                                      | HTTP REST / SSE MCP / WebSockets
                                      v
+-----------------------------------------------------------------------------------+
|                                KYLRIX CORE SERVER                                 |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Middleware Layer: Better Auth + Route Protection + API PAT Gateways         |  |
|  +-----------------------------------------------------------------------------+  |
|  | Application Routing & Server Actions (`lib/actions/turso-ops.ts`)            |  |
|  +-----------------------------------------------------------------------------+  |
|  | ApiResources Dispatch (`lib/api/resources.ts` / `mcpToolHandlers`)            |  |
|  +-----------------------------------------------------------------------------+  |
|  | Database Layer: Drizzle ORM Repository (`lib/db/repository.ts`)               |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
        |                                       |                          |
        v                                       v                          v
+---------------+                       +---------------+          +---------------+
|  Turso SQLite |                       | PartyKit Server|          | BlockBee Pay  |
| (Primary DB)  |                       | (Realtime WS) |          | (Crypto/Subs) |
+---------------+                       +---------------+          +---------------+
```

---

## ⚡ Local-First Substrate & Hybrid Execution Model

Kylrix operates on a **Local-First, Remote-Synchronized** paradigm:

1. **Immediate Local Hydration:**
   - Client-side read/write operations execute against `LocalEngine` (IndexedDB / LocalStorage in browser; local SQLite in CLI and VS Code).
   - UI updates reflect sub-5ms optimistic mutations before network packets are transmitted.

2. **Background Autonomic Sync (`autonomicSyncEngine`):**
   - Mutations are queued with key prefixes (`note:`, `goal:`, `cred:`, `totp:`, `event:`, `form:`).
   - Writes are debounced dynamically (`150ms` typing debounce, `500ms` hard ceiling).
   - Sync flushes execute via atomic server actions (`upsertNotesBatchTurso`, `upsertGoalsBatchTurso`, etc.) passing `{ skipPending: true }` to avoid re-queuing loops.

3. **Real-Time WebSocket Invalidation (PartyKit):**
   - Server writes broadcast lightweight WebSocket events to PartyKit channel subscribers.
   - Connected clients execute targeted local cache revalidations via `LocalEngine.hasObjectDiff` dirty checking without replacing local pending edits.

---

## 🔒 Security & Zero-Knowledge Architecture

- **Zero-Knowledge Vault:** Vault secrets (`credentials`, `totpSecrets`) are encrypted client-side using Web Crypto AES-256-GCM.
- **Key Hierarchy:**
  - **Master Password (MasterPass):** Derived via **Argon2id** (64MB memory, 3 iterations, 4 parallelism) with OWASP-recommended **PBKDF2-HMAC-SHA256** (600,000 iterations) fallback.
  - **Master Encryption Key (MEK):** Unwraps Data Encryption Keys (DEKs) associated with workspaces and items.
- **RAM Zero-Clearing:** The CLI `kylrix exec` subcommand injects transient environment variables directly into process memory and explicitly zero-clears string allocations upon process exit (`childEnv[key] = ''`).

---

## 🤖 Agent Interoperability Protocol Stack

Kylrix exposes workspace capabilities to autonomous agents across four unified transport interfaces:

1. **Model Context Protocol (MCP Server):** Streamable HTTP (`/api/v1/mcp`) & SSE transport exposing 20+ tool handlers.
2. **REST API (`/api/v1/*`):** Scoped Personal Access Token (PAT) and OAuth 2.1 authentication for scripts, workflows, and SDK clients.
3. **WebMCP (W3C Standard):** Browser-native tool exposition via `navigator.modelContext` allowing in-browser AI assistants (e.g. ChatGPT, Chrome Canary AI) to interact with user context directly.
4. **CLI & Stdio Bridge:** Local-first terminal management and MCP stdio connection bridge (`kylrix stdio`).

---

## 📂 Codebase Directory Topology

| Directory | Purpose |
|---|---|
| `app/` | Next.js 15 App Router pages, REST API endpoints (`app/api/v1`), OAuth routes, and share entrypoints. |
| `components/` | React frontend components, topbar/sidebar surfaces, OpenBricks UI primitives, and overlay drawers. |
| `context/` | React state providers (`TaskContext`, `NotesContext`, `WorkspaceContext`, `UnifiedDrawerContext`). |
| `lib/` | Core business logic, database ORM (`lib/db`), security engines, sync engine, billing providers. |
| `packages/` | Standalone monorepo packages (`packages/cli` and `packages/vscode`). |
| `sdk/` | Reusable TypeScript SDK for external application integration (`@kylrix/sdk`). |
| `docs/` | Comprehensive technical and ecosystem documentation. |
| `.agents/skills/` | Agent skill definitions and operational rules. |
