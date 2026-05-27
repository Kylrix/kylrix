# Phase: Ecosystem Hardening & Convergence

## Priority 1: Abuse Mitigation (Quota Enforcement)
**Goal**: Prevent storage and database bloat from anonymous or malicious high-volume `/send` uploads.
**Strategy**: Implement a tiered quota system in `lib/api-key.ts` and `secure-ops.ts`.
-   **Anonymous Quota**: Strict limit on active Send links and total file bytes per IP/Device ID (7-day sliding window).
-   **Authenticated Quota**: Higher limits for free users, unlimited/premium limits for Pro users.
-   **Enforcement**: Check quotas at the "Secure Action" layer before executing `tables.createRow` or `storage.createFile`.

## Priority 3: Architectural Convergence (Hexagonal Migration)
**Goal**: Eliminate direct database mutations in `accounts/api` and consolidate all writes into `secure-ops.ts`.
**Strategy**: Standardize the "Gatekeeper" pattern.
-   **Audit**: Map all `POST`, `PATCH`, `DELETE` handlers in `app/(app)/(auth)/accounts/api/` that use direct `node-appwrite` or `appwrite` clients.
-   **Escalation**: Move business and permission logic to `lib/actions/secure-ops.ts`.
-   **Hexagonal Registry**: Ensure all new actions use `Registry.getDatabase()` with the `forceSystem: true` flag for verified escalations, maintaining the read-only DB mandate.
