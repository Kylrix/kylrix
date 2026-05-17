# Server SDK Security Hardening Plan

## 1. Objective
Eliminate all theoretical vectors for User ID impersonation or cross-account resource control by strictly tying all privileged Admin SDK operations to verified session actors.

## 2. Identified Hardening Tasks

### A. Strict Identity Overwrite
- [ ] **Global Action Audit**: Review all `use server` actions in `lib/actions/`.
- [ ] **Forced ID Injection**: Ensure that any `userId` or `ownerId` parameter provided by the client is strictly overwritten by `actor.$id` (retrieved via `getActor()`) before being passed to any internal service.
- [ ] **Target Validation**: For operations involving a `targetUserId` (like sharing), verify that the `actor` has explicit permission to interact with that specific resource via an admin-side read before executing the mutation.

### B. Authorization Policy Layer
- [ ] **Centralize hasWriteAccess**: Move resource-specific ownership checks (like the one in `secure-ops.ts`) into a dedicated `@/lib/security/policies.ts`.
- [ ] **Policy-First Execution**: Mandate that every Admin SDK call must be preceded by a call to the policy layer that accepts the verified `actorId`.

### C. Audit Logging & Monitoring
- [ ] **Privileged Event Ledger**: Implement a mandatory `logPrivilegedAction` call for every Server Action.
- [ ] **Record Metadata**: Logs must include `actorId`, `actionType`, `resourceId`, and a timestamp. This creates an immutable trail of who controlled what resource using the Server SDK.

### D. Session Integrity
- [ ] **Double-Submit Verification**: Explore adding a secondary custom header check (e.g., `x-kylrix-actor-id`) in Server Actions to ensure requests originate from the trusted application UI, providing defense-in-depth against CSRF.

## 3. Implementation Status
- **Status**: PENDING
- **Priority**: Secondary (Post-Stability)
