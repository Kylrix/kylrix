# Kylrix Agent Skills Catalog

**Read this file first.** Then open only the one skill that matches your domain task. Do not scan skills one-by-one.

Hard policy also lives in repo-root `AGENTS.md` (Table/Row terms, single DB `passwordManagerDb`, no new in-app `app/api` routes, pnpm only, `/flows` + `/workspace/[id]` share routing — never `/workspaces`).

*Consolidated catalog covers 22 core skills (streamlined from 100+ to prevent model hallucination).*

---

## 1. Core Architecture & System Directives

| Skill | Description |
|---|---|
| `kylrix` | **North Star:** Anti-fragility, vendor independence, decade survivability, bare-metal end state. Read before major architecture, backend, or dependency decisions. |
| `guardrails` | Enforces Kylrix architecture rules, routing (`/flows`, `/workspace/[id]`), shipping velocity, same-tab navigation, and dead-code hygiene. |
| `system.ops` | Hexagonal DI registry, Server SDK actions, query expression mappers, build error fixes, chat relay, and join gating. |
| `why` | Architectural rationale library: zero-trust invariants, data sovereignty, E2EE vs UX balance, passkeys, crypto checkout, and Telegram notification bridges. |

---

## 2. Design System & UI

| Skill | Description |
|---|---|
| `openbricks` | **Canonical** OpenBricks design system: opaque ash surfaces (`#161412`), pitch-black cards (`#000000`), pure white text (`#FFFFFF`), mobile drawers vs desktop right sidebars, and plan upgrade patterns. |

---

## 3. Security, Vault & Cryptography

| Skill | Description |
|---|---|
| `security` | Complete zero-knowledge security architecture: Argon2id key stretching, MasterPass, AES-256-GCM encryption, RAM ephemeral unlock sessions, Sudo Mode, MFA verification, and RLS bypass. |

---

## 4. Data, Local-First Sync & Storage

| Skill | Description |
|---|---|
| `sync` | Canonical offline-first sync engine: RxDB/IndexedDB substrate (LocalEngine), autonomic sync queue, local-copy merge reconciliation, and read-through caching. |
| `storage` | File upload standards, storage buckets, subscription plan upload gates, and client-side image compression. |

---

## 5. Backend & Appwrite

| Skill | Description |
|---|---|
| `appwrite-cli` | Durable CLI operations, additive-only database migrations, table/column/index manipulation, and strict push protection. |
| `appwrite-typescript` | Appwrite TypeScript SDK reference for client-side queries, real-time events, and Server SDK actions. |
| `selfhost` | Single-command bundled Docker Compose self-hosting (`./selfhost.sh`), container stack, and schema bootstrap. |

---

## 6. APIs, Protocols & Developer Platform

| Skill | Description |
|---|---|
| `api` | Kylrix HTTP API (`/api/v1`), Personal Access Tokens (PATs), rate limiting, developer scopes, and programmatic resource CRUD. |
| `mcp` | Model Context Protocol (MCP) server: Stateless JSON-RPC over Streamable HTTP for AI tools, Claude Code, Cursor, and autonomous agents. |
| `oauth2` | Sign in with Kylrix OAuth 2.1 / OIDC identity provider, authorization code flow with PKCE, and consent token exchange. |

---

## 7. Product Domains & Entities

| Skill | Description |
|---|---|
| `note` | Notes SDK, private/shared/public partitioning, crosslinks tagging relations, and shared caching. |
| `threads` | Unified plaintext discussions, comments, thread messages, and reactions across notes, goals, workspaces, and objects. |
| `workspace` | Workspaces UI over `projects` table, `project_objects` join mapping, workspace filtering, and workflow engine. |
| `billing` | BlockBee Pro/Teams crypto checkout, subscription ledger, coupons, and $KYLRIX token ledger minting. |

---

## 8. Agentic AI & Governance

| Skill | Description |
|---|---|
| `agents` | Autonomous AI agents, zero-trust provisioning keys, client-side MEK derivation, and sovereign multi-chain identity. |
| `agentic.runtime` | In-app agent runtime, agent drawers, tools registry, execution sandboxing, and Vercel AI SDK integration. |
| `ota` | Ota governance framework, contracts (`ota.yaml`), doctor verification, and run workflows. |
| `vercel` | Safe Vercel CLI workflows, production/preview deployment guidelines, and environment variable rules. |
