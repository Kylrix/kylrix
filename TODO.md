# 📋 Kylrix Tactical Tasks & Core Pain Points

Targeted, high-impact technical challenges currently open in the Kylrix ecosystem.  
*No low-hanging fruit. Every task below addresses concrete architectural bottlenecks or core UX friction.*

> 💡 **Developer Contributor Program**:
> Have a merged PR solving any item below (or any custom fix/feature) within the last 30 days to receive **Kylrix Pro free forever**. See [**`CONTRIBUTING.md`**](CONTRIBUTING.md) and [`README.md`](README.md#🎁-contributor-program) for automated verification.

---

### 1. Appwrite Phase-Out & Better Auth / Turso Consolidation
- [ ] **Eradicate Appwrite SDKs & Legacy Adapters**:
  - Systematically audit and purge `node-appwrite`, `appwrite` client SDK, `lib/appwrite/`, and legacy Appwrite DI storage/auth adapters across the codebase.
- [ ] **Full Authentication Migration to Better Auth**:
  - Replace lingering Appwrite account session helpers, client login drawer flows, and OAuth callbacks with native Better Auth plugins, secure cookies, and session middleware.
- [ ] **Consolidate Core Entities onto Turso (libSQL) & Drizzle**:
  - Re-route all remaining Appwrite CRUD and Server Actions (`notes`, `vault`, `goals`, `flows`, `projects`) exclusively through Drizzle schemas targeting Turso/SQLite.
- [ ] **De-Appwritize Schemas & Self-Host Compose**:
  - Deprecate `appwrite.config.json` and remove bulky Appwrite container services (MariaDB, Redis, Influx) from `docker-compose.yml`, streamlining self-hosting down to a pure Next.js + Turso stack.

---

### 2. Storage & Offline Sync Engine
- [ ] **Bi-directional CRDT Sync for Embedded SQLite**:
  - Replace naive `last_modified` overwrites with delta-based change vectors in `packages/cli/src/local/sync-resolver.ts` to prevent race conditions during concurrent multi-device updates.
- [ ] **Streaming Large Blob Encryption & Chunked Resumable Uploads**:
  - Implement zero-knowledge client-side AES-GCM chunked stream encryption for multi-gigabyte files so large backups stream directly without buffering in browser/node memory.
- [ ] **Turso / libSQL Vector Indexing for Semantic Search**:
  - Implement native vector embeddings indexing directly in Turso / SQLite tables for notes, goals, and agent logs to allow sub-5ms semantic similarity queries offline.

---

### 3. Autonomous Agent Runtime & Execution Sandbox
- [ ] **Wasmtime / QuickJS Execution Sandboxing for Custom Flow Tools**:
  - Replace Node.js eval / dynamic imports with an isolated WebAssembly QuickJS sandbox to run user-defined automation flow nodes without exposing process environment or filesystem privileges.
- [ ] **Persistent Agent Execution State Recovery & Time-Travel Debugging**:
  - Implement durable snapshotting for agent tool executions in `lib/agentic/client-executor.ts` allowing stalled or failed agentic runs to be replayed or resumed from any arbitrary step.
- [ ] **Unified Multi-Agent Communication Bus over WebSockets / SSE**:
  - Standardize real-time duplex streaming for agent inboxes, coordinating human-in-the-loop approvals with subagent delegation without HTTP polling overhead.

---

### 4. Developer Tools, CLI & External Workspaces
- [ ] **Cross-Client Context Distillation Protocol (`kylrix connect`)**:
  - Build an autonomous watcher daemon in `@kylrix/cli` that detects context shifts across IDEs (Cursor, Claude Code, Antigravity) in real time and updates synthesized project memory.
- [ ] **Shell Auto-Completion & Dynamic Workspace Context Engine**:
  - Implement complete Bash, Zsh, and Fish shell completions with dynamic contextual lookups for IDs, workspaces, and secrets.
- [ ] **Zero-Leak Process Wrapper (`kylrix exec`)**:
  - Create a POSIX-compliant process wrapper that unlocks vault secrets into transient child env blocks (`kylrix exec -- <command>`), securely zeroing RAM immediately upon child termination.

---

### 5. Zero-Trust Security & Vault Infrastructure
- [ ] **Argon2id Memory Hardening & Web Worker Offloading**:
  - Offload heavy Argon2id key derivation passes (64MB memory cost) in `lib/masterpass-crypto.ts` into isolated Web Workers to prevent UI thread frame drops during vault unlocking.
- [ ] **Passkey-Backed MasterPass Wrapping (PRF Extension)**:
  - Utilize WebAuthn PRF (Pseudo-Random Function) extension to derive Master Encryption Keys directly from biometric passkeys (TouchID / Windows Hello / YubiKey) without requiring manual MasterPass entry.
- [ ] **Encrypted Real-Time Sudo Mode Heartbeat**:
  - Implement cryptographic session token rotation with hardware token presence detection for elevated Sudo actions (modifying vault items, exporting TOTP seeds).
