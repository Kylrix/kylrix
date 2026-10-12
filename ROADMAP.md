# 🎯 Kylrix Roadmap

High-level engineering vision, systemic architectural objectives, and decade-scale product pillars for the Kylrix ecosystem.

For tactical issues, pain points, and current sprints, see [**`TODO.md`**](TODO.md).  
For the developer reward program, see [**`CONTRIBUTING.md`**](CONTRIBUTING.md).

---

## 🚀 Pillar 1: Appwrite Phase-Out & Pure Better Auth / Turso Transition

Our primary systemic objective is eliminating third-party backend bloat and establishing a lean, sovereign stack powered by **Better Auth** and **Turso (libSQL)**.

- [ ] **Zero-Appwrite Runtime & Dependency Eviction**:
  - Completely eradicate `@appwrite.io/console`, Appwrite client/server SDKs, and legacy admin singletons from the entire codebase.
  - Eliminate all remaining `lib/appwrite/` utilities, Appwrite DI adapters, and legacy document/collection abstractions.
  - Deprecate `appwrite.config.json` and remove the multi-container MariaDB/Redis Appwrite stack from self-host environments.
- [ ] **First-Class Better Auth Architecture**:
  - Migrate all session handling, email/password, social OAuth 2.1, passkey/WebAuthn, and MFA flows to a unified Better Auth instance.
  - Implement zero-overhead server session validation across Next.js middleware, Server Actions, and `/api/v1` routes.
  - Native multi-tenant workspace scoping directly integrated into Better Auth organization plugins.
- [ ] **Canonical Turso (libSQL) Relational Layer**:
  - Consolidate all primary tables (notes, goals, workspaces, agents, vaults, forms, flows) onto Turso using Drizzle ORM.
  - Ensure zero runtime schema drift between embedded local SQLite (`@kylrix/cli`, LocalEngine) and remote distributed Turso instances.
  - Build automated database migration tooling to transition legacy self-hosted instances from Appwrite/MariaDB to pure Turso / SQLite.

---

## 🏛️ Pillar 2: Anti-Fragile Zero-Vendor Architecture

User data and local agent cognition must outlive cloud infrastructure providers and operate with 100% offline survivability.

- [ ] **Multi-Model Local Inference Orchestration**:
  - Direct zero-latency integration with local Ollama, llama.cpp, and vLLM runtimes alongside cloud LLMs.
  - Context caching and semantic routing across local models and remote reasoning models without leaking unencrypted project prompts.
- [ ] **Multi-Engine Storage Agnosticism**:
  - Seamless migration pathways between embedded SQLite (local/node:sqlite), distributed Turso (libSQL), and standalone Postgres backends without app-level schema divergence.
- [ ] **WebAssembly (WASM) Local Cryptographic Primitives**:
  - Portable, audit-grade WebAssembly compilation for Argon2id, AES-256-GCM, and Ed25519 signatures across both browser workers and embedded terminal runtimes.

---

## 🤖 Pillar 3: Autonomous Agent Mesh & Sovereign Workspaces

Workspaces are first-class execution domains shared equally between human developers and autonomous AI agents.

- [ ] **Decentralized Agent Mesh Protocol**:
  - WebRTC and Libp2p direct peer-to-peer tunnels allowing local IDE agents (Cursor, Windsurf, Claude Code, AGY) to coordinate sub-tasks across separate machines with zero intermediary relay.
- [ ] **Granular Object-Level Capability Grants**:
  - Cryptographic object capabilities (O-Caps) granting subagents ephemeral, read-only or read-write access to specific notes, credentials, or task trees without exposing the whole workspace.
- [ ] **Self-Synthesizing Cross-Tool Memory Layer**:
  - Real-time directory-by-directory context distillation capturing decisions made across Claude, Cursor, Antigravity, and terminal CLI sessions into unified, searchable graph memory.

---

## 🔐 Pillar 4: Zero-Leak Project Environments & Keychains

Development environments and production secrets must remain impenetrable across compromised runtimes.

- [ ] **Hardware Security Module (HSM) & Secure Enclave Integration**:
  - Native bridging with Apple Secure Enclave, YubiKey, and Linux TPM2 for holding MasterPass root entropy without exposing private keys to system RAM.
- [ ] **Automated Ephemeral Secret Injection**:
  - Dynamic `kylrix exec --env <project> -- <command>` running child build processes with injected RAM-only environment variables that immediately purge on process termination.
- [ ] **Real-Time Secret Revocation & Leak Sentinel**:
  - Background memory sanitizer continuously checking outgoing agent tool outputs against active encrypted secret hashes before dispatching to remote inference APIs.

---

## 🌐 Pillar 5: Decentralized Real-Time Sync & Sovereign Identity

- [ ] **Conflict-Free Replicated Data Types (CRDT) for Relational State**:
  - Upgrading local SQLite and cloud replication engines to conflict-free relational CRDTs for multi-device live editing with zero merge collisions.
- [ ] **Decentralized Identifiers (DID) & Passkey Sovereignty**:
  - Cross-platform WebAuthn/Passkey identity verification enabling self-sovereign accounts without third-party OAuth provider dependencies.
