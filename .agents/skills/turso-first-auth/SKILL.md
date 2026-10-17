# Turso-First Auth and Data Loading

## Purpose

Keep authenticated product flows fast and deterministic during the Appwrite-to-Better Auth/Turso migration.

## Required rules

- Resolve the Better Auth session before attempting any legacy JWT, registry, or Appwrite-compatible adapter.
- Server Actions must use `auth.api.getSession({ headers: await headers() })` as the primary actor source.
- Client loaders must use the Better Auth session ID and call direct Turso actions.
- Never make a dead legacy request a prerequisite for vault unlock, MasterPass detection, admin checks, token operations, referrals, or object lists.
- Treat an empty result as a valid empty Turso result only after the direct Turso query completes; do not silently replace it with a slow legacy fallback.
- Keep encrypted payloads opaque. Normalize only metadata required by the UI; never log secrets, salts, wrapped keys, or plaintext.

## Review checklist

When a screen is slow or reports missing data:

1. Trace the first authentication call and remove legacy-first ordering.
2. Verify the direct Turso table and ownership predicate.
3. Check for empty stubs (`return []`, `return false`) and Appwrite fallback calls.
4. Preserve workspace and encryption filtering after the direct query.
