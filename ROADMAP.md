# 🎯 Kylrix Roadmap

High-level engineering vision, systemic architectural objectives, and decade-scale product pillars for the Kylrix ecosystem.

For tactical issues, pain points, and current sprints, see [**`TODO.md`**](TODO.md).  
For the developer reward program, see [**`CONTRIBUTING.md`**](CONTRIBUTING.md).

---

## 🏛️ Pillar 1: Anti-Fragile Zero-Vendor Architecture

Our north-star architectural thesis is that user data and local agent cognition must outlive cloud infrastructure providers.

- [ ] **Multi-Model Local Inference Orchestration**:
  - Direct zero-latency integration with local Ollama, llama.cpp, and vLLM runtimes alongside cloud LLMs.
  - Context caching and semantic routing across local models and remote reasoning models without leaking unencrypted project prompts.
- [ ] **Multi-Engine Storage Agnosticism**:
  - Seamless migration pathways between embedded SQLite (local/node:sqlite), distributed Turso (libSQL), and standalone Postgres/MariaDB backends without app-level schema divergence.
- [ ] **WebAssembly (WASM) Local Cryptographic Primitives**:
  - Portable, audit-grade WebAssembly compilation for Argon2id, AES-256-GCM, and Ed25519 signatures across both browser workers and embedded terminal runtimes.

---

## 🤖 Pillar 2: Autonomous Agent Mesh & Sovereign Workspaces

Workspaces are first-class execution domains shared equally between human developers and autonomous AI agents.

- [ ] **Decentralized Agent Mesh Protocol**:
  - WebRTC and Libp2p direct peer-to-peer tunnels allowing local IDE agents (Cursor, Windsurf, Claude Code, AGY) to coordinate sub-tasks across separate machines with zero intermediary relay.
- [ ] **Granular Object-Level Capability Grants**:
  - Cryptographic object capabilities (O-Caps) granting subagents ephemeral, read-only or read-write access to specific notes, credentials, or task trees without exposing the whole workspace.
- [ ] **Self-Synthesizing Cross-Tool Memory Layer**:
  - Real-time directory-by-directory context distillation capturing decisions made across Claude, Cursor, Antigravity, and terminal CLI sessions into unified, searchable graph memory.

---

## 🔐 Pillar 3: Zero-Leak Project Environments & Keychains

Development environments and production secrets must remain impenetrable across compromised runtimes.

- [ ] **Hardware Security Module (HSM) & Secure Enclave Integration**:
  - Native bridging with Apple Secure Enclave, YubiKey, and Linux TPM2 for holding MasterPass root entropy without exposing private keys to system RAM.
- [ ] **Automated Ephemeral Secret Injection**:
  - Dynamic `kylrix exec --env <project> -- <command>` running child build processes with injected RAM-only environment variables that immediately purge on process termination.
- [ ] **Real-Time Secret Revocation & Leak Sentinel**:
  - Background memory sanitizer continuously checking outgoing agent tool outputs against active encrypted secret hashes before dispatching to remote inference APIs.

---

## 🌐 Pillar 4: Decentralized Real-Time Sync & Sovereign Identity

- [ ] **Conflict-Free Replicated Data Types (CRDT) for Relational State**:
  - Upgrading local SQLite and cloud replication engines to conflict-free relational CRDTs for multi-device live editing with zero merge collisions.
- [ ] **Decentralized Identifiers (DID) & Passkey Sovereignty**:
  - Cross-platform WebAuthn/Passkey identity verification enabling self-sovereign accounts without third-party OAuth provider dependencies.
