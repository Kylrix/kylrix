Task: Fix rogue E2E identity (P-256) injection and restore Connect chat integrity

Summary
- Root cause: Legacy/rogue agent wrote P-256/EC JWKs into Vault keychain as `e2e-identity`. Mono repo security now enforces X25519 (JWK kty 'OKP'), so loadE2EIdentity throws INVALID_ALGORITHM, aborting identity import and blocking chat decryption. Standalone connect tolerated the mismatch.

Opinionated directive
1) Immediate mitigation (fast, low-risk)
   - Make loadE2EIdentity tolerant: DO NOT throw on JWK kty mismatch. Instead, log, mark the identity row as "legacy-broken", emitStatusChange, and continue. This prevents UI lockups and unauthorized re-render loops.
   - Implement a short-circuit in background tasks: require requester/user exist BEFORE running crypto loads (follow auth-lifecycle-guardrails). Return early instead of throwing.

2) Audit & discovery (non-destructive)
   - Run an admin audit script (below) to list all `e2e-identity` rows, attempt decrypt with current MEK, record JWK.kty values and timestamps. Output CSV with userId,rowId,kty,createdAt.

3) Migration & repair strategy (safe, explicit)
   - For rows with kty !== 'OKP': treat as unrecoverable E2E identity (legacy curve) and rotate for the user:
     a) Create a new X25519 key pair client-side (or via secure admin flow), wrap it with current MEK, store as new `e2e-identity` row.
     b) Mark legacy row `status: 'legacy-broken'` and preserve for forensic logs only (do NOT try to convert EC->OKP).
     c) Notify affected users (in-app banner + email) that old DMs are unrecoverable and require key rotation.

4) Prevent recurrence (hard guardrails)
   - Add schema validation in appwrite Table (or a pre-write server-side check) that rejects `e2e-identity` writes whose JWK.kty !== 'OKP'.
   - Add runtime write wrapper: `writeE2EIdentity(userId, jwk)` that validates kty and curve and tags row with `version: 'v2-x25519'`.

5) Tests & monitoring
   - Add unit tests for loadE2EIdentity to handle OKP, EC, and malformed payloads gracefully.
   - Add a periodic audit job (weekly) to surface any non-OKP keychain rows to ops channel.

Admin audit script (TypeScript, run with admin credentials only)

```ts
import { createAdminClient } from './lib/appwrite/admin';
import { APPWRITE_CONFIG } from './lib/appwrite/config';

async function auditE2E() {
  const client = createAdminClient();
  // Note: page through results in production; simplified for illustration
  const rows = await client.listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN, [
    // filter type e2e-identity; page through in production
  ]);

  const report = [] as any[];
  for (const r of rows.rows) {
    try {
      // attempt to decrypt using server-held MEK (if available) or flag for manual review
      // WARNING: do NOT expose MEK in logs
      const raw = await decryptWithMEKSafe(r.wrappedKey); // implement securely
      const data = JSON.parse(raw);
      report.push({ userId: r.userId, rowId: r.$id, kty: data.publicKey?.kty || 'unknown', createdAt: r.$createdAt });
    } catch (e) {
      report.push({ userId: r.userId, rowId: r.$id, kty: 'decryption-failed', createdAt: r.$createdAt });
    }
  }
  console.log(JSON.stringify(report, null, 2));
}
```

Client tolerant loader snippet (surgical)

```ts
// inside loadE2EIdentity
const raw = await this.decrypt(entry.wrappedKey).catch(e => { console.warn('[Security] decrypt failed', e); return null; });
if (!raw) return; // don't throw: continue gracefully
const data = JSON.parse(raw);
if (data.publicKey?.kty !== 'OKP') {
  console.warn('[Security] Legacy identity detected - marking for migration', data.publicKey?.kty);
  // Mark the row locally for migration/ops; do NOT throw
  await markKeychainRowLegacy(entry.$id);
  return; // leave identityKeyPair null
}
// normal X25519 import flow...
```

Security note
- Any migration that claims to "convert" EC -> OKP is cryptographically invalid; treat legacy keys as unrecoverable and rotate.
- Ensure all admin scripts run with least privilege and never log raw keys or unwrapped MEK bytes.

Ecosystem policy update (short)
- Enforce `kty: 'OKP'` for `e2e-identity` at write time.
- Add `keyVersion` property to keychain rows. New writes must be `v2`.

Eureka
- The UI freeze came from a thrown error during identity load and an unauthenticated background task loop. The safe path: fail-open (no identity) but keep the UI responsive, then schedule user-facing rotation.

References
- auth-lifecycle-guardrails SKILL.md
- vault-security SKILL.md
- lib/ecosystem/security.ts (mono repo)
