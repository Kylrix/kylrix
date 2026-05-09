---
name: accounts-api
description: Handles privileged server logic in Accounts routes and actions. Use when editing auth/session/cors/permissions, billing/referrals, or secure cleanup handlers.
disable-model-invocation: true
---

# Accounts API

## Scope

- `app/(app)/(auth)/accounts/api/**`
- `app/(app)/(auth)/accounts/actions/**`
- server-only internal helpers used by those routes

## Rules

1. Treat Accounts as root of trust.
2. Enforce requester ownership/admin checks on destructive endpoints.
3. Keep CORS/origin/session verification explicit.
4. Never trust client-provided user identity without server validation.
5. For privileged endpoints, admin auth must include `ADMINS` env email allowlist checks (not labels alone).
6. Sensitive cross-user/system operations must run through server SDK (`createAdminClient`) in accounts/internal services.
7. If endpoint touches token/network state, require explicit initialized-state checks before mutation.

