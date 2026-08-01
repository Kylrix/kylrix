---
name: architecture.security-session
description: >-
  Unlock session and trust-boundary invariants (no key/table names). Use when
  prompting unlock, sealing secrets, or privileged writes.
---

# Security session architecture

1. **Unlock = RAM session.** The derived vault key lives in process memory for the tab/session. It is not a durable “stay unlocked forever” unless a future remember-unlock path is explicitly wired.
2. **Prompt on gated ops.** Ask for unlock when opening sealed material or privileged secure actions—not on every route change by default.
3. **No browser enclave dump.** There is no general Secure Enclave API for arbitrary app blobs. Platform authenticators (passkeys) sign/PRF; they do not give you a free enclave key-value store.
4. **Client seals; server escalates.** Sensitive fields are sealed client-side. Writes that need privilege go through server actions / admin adapters with ownership checks—not new public HTTP product APIs.
5. **System lock is broadcastable.** A lock directive clears in-memory unlock state across the mesh; treat lock as intentional, not navigational noise.
6. **Sudo ≠ infinite trust.** Temporal sudo/unlock windows stay short-lived and non-durable by default.

Companions: `security.sudo-mode-gate`, `security.vault-keychain`, `security.database-read-only-rls`.
