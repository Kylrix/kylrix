---
name: getzup
description: >-
  Architecture, cryptography, OAuth2, and local-first sync guidance for Zup —
  a standalone client-only Nostr application built on OpenBricks, RxDB, and
  Kylrix identity primitives.
---

# Zup — Standalone Nostr Client Architecture & Kylrix Integration

**Zup** is a standalone, client-only Nostr client built with **OpenBricks 4.0** UI components and **RxDB / IndexedDB** local storage. While Zup is an independent application, it shares core cryptographic, local-first, and identity architecture with Kylrix.

This skill outlines how Zup must structure its local-first database, identity linking, OAuth2 ("Sign in with Kylrix"), zero-knowledge encryption, and sync reconciliation.

---

## 1. Core Architecture & Philosophy

1. **Client-Only & Local-First**: Zup runs entirely in the browser using RxDB (IndexedDB). Nostr relays provide global event propagation, while Kylrix acts as an optional cloud identity anchor and encrypted state sync provider.
2. **0ms First Paint**: Zup must load user feeds, cached events, and active identities instantly from local RxDB before making network calls to relays or Kylrix endpoints.
3. **OpenBricks Native**: Zup uses OpenBricks 4.0 design tokens (opaque ash surfaces, dark mode only, no background blurs/gradients, mobile top/bottom drawers translating to desktop right sidebars). Standalone single icons (navbar items) must remain clean without individual box enclosures.

---

## 2. Onboarding & Identity Modes

Zup supports two primary onboarding paths:

### Path A: "Create Identity" (Native Nostr Mode)
- Generates a local Nostr keypair (`nsec` / `npub`) entirely on-device using standard CSPRNG.
- Stores encrypted `nsec` in Zup's local RxDB (`f_nostr_identities`).
- User can immediately use Zup without any Kylrix account.
- If the user later decides to connect Kylrix, Zup initiates account reconciliation (see Section 4).

### Path B: "Sign in with Kylrix" (OAuth 2.1 + PKCE)
- Zup initiates an OIDC / OAuth 2.1 PKCE authorization flow against Kylrix's Appwrite OAuth2 server.
- Redirects to `https://www.kylrix.space/oauth/consent` with `client_id`, `redirect_uri`, `scope`, `state`, and `code_challenge`.
- **Required Scopes**: `openid`, `profile`, `email`, plus custom scopes `notes:read`, `profile:read`.
- Upon successful exchange of the authorization code at `/token`, Zup receives an OIDC ID token, OAuth access token (JWT), and refresh token.
- **Refresh Token Rotation**: Refresh tokens rotate upon every exchange. Zup must handle rotation carefully — using an expired refresh token invalidates the entire client-user session.
- Zup queries Kylrix `/api/v1/me` (or OIDC userinfo) to retrieve the active Kylrix `userId` and associated Nostr identity metadata.

---

## 3. Nostr ID ↔ Kylrix User ID Binding & Directional Sync

### Binding Mechanisms
To tie a Kylrix `userId` to a Nostr `pubkey`:
1. **NIP-78 (Application-Specific Data)**: Zup publishes an encrypted Kind 30078 event to the user's relays containing `{"kylrix_user_id": "<userId>", "linked_at": "<timestamp>"}`.
2. **Appwrite User Preferences**: When signed in with Kylrix, Zup updates the user's Appwrite account preferences (`account.updatePrefs({ nostr_pubkey: "<npub>", active_identity: "<npub>" })`).
3. **NIP-05 Identity Linking**: Optional NIP-05 mapping on `kylrix.space` (e.g., `alice@kylrix.space`).

### Directional Sync Tracking
Zup must explicitly track synchronization state and direction for every entity:

| Scenario | Primary Direction | Data Flow & Behavior |
|----------|-------------------|----------------------|
| **Pure Sign In with Kylrix** | **Kylrix → Zup** | Zup mirrors the active Nostr identity, relays, and user settings from Kylrix. Zup populates local RxDB tables (`f_user_settings`, `f_nostr_identities`). |
| **New Kylrix Account from Zup** | **Zup → Kylrix** | Zup pushes local Nostr keys, relays, and MasterPass encryption primitives up to newly provisioned Kylrix account storage. |
| **Connecting Existing Kylrix to Existing Zup** | **Bi-directional Merge** | Zup prompts user to select active Nostr identity or merge keychains. Local RxDB records are flagged with `sync_origin: 'zup'` or `'kylrix'`. |

### Multi-Identity Management
Users may have multiple Nostr identities (`npub`s) attached to one Kylrix account. Zup's identity manager must allow quick identity switching while preserving separate local RxDB keyspaces and active session pointers.

### Safe Disconnect Mechanics
Disconnecting Kylrix from Zup must be executed with extreme care:
- **Do NOT wipe local Nostr keys**: Disconnecting Kylrix removes OAuth tokens and stops remote Appwrite state sync, but must preserve all local Nostr identities and local RxDB data.
- **Revoke OAuth Session**: Call Appwrite `/v1/oauth2/revoke` or `/v1/account/sessions/oauth2/<SESSION_ID>` to invalidate the token on Kylrix servers.
- **Clear Sync Metadata**: Reset `sync_origin` pointers in local RxDB to `'local_only'`.

---

## 4. LocalEngine & Local-First Architecture

Zup follows Kylrix's local-first architecture (`architecture.local-first` & `sync` skills):

1. **Live Local Copy as Content SoT**: UI components subscribe directly to RxDB collections (`f_user_settings`, `f_nostr_identities`, `f_feed_settings`, `f_keychain`). Network fetches (from relays or Kylrix) only `upsert` into RxDB.
2. **Forward-Reactive Sync Engine**:
   - Local edits mutate RxDB instantly (0ms latency).
   - Mutations enqueue an entry in `autonomicSyncEngine` pending queue (`markPending(id, revision)`).
   - A coalesced flush runs in the background (~450ms debounce) to push updates to Appwrite/Relays.
3. **Amber/Green Sync Status**:
   - **Amber dot**: Item has unflushed local changes pending network confirmation.
   - **Green dot**: All local revisions confirmed by remote server/relay (`ack(id, revision)`).
4. **Interpolation Engine (Conflict Resolution)**:
   - If an item is pending local flush (`isPending(id) === true`), **local copy strictly wins**.
   - If no local changes are pending, timestamp comparison (`updatedAt` / `$updatedAt`) resolves conflicts — newer timestamp wins.
5. **Account Reconciliation**:
   When an existing Zup user subsequently links a Kylrix account:
   - Query remote `f_user_settings` and `f_keychain`.
   - If remote settings exist, perform soft merge: un-synced local Zup settings are preserved and pushed to remote; missing settings are pulled from Kylrix.
   - Show reconciliation UI in OpenBricks drawer if conflicting Nostr identities exist.

---

## 5. MasterPass Crypto, Passkeys & Zero-Knowledge Encryption

Zup adopts Kylrix's **zero-knowledge Master Encryption Key (MEK)** architecture (`security.masterpass-crypto` & `security.vault-keychain`).

### Key Derivation & Stretching
- **Master Encryption Key (MEK)**: A 256-bit AES-GCM symmetric key generated randomly on setup (`generateRandomMEK()`).
- **Argon2id (Primary Derivation)**:
  - Memory: 64 MB (`65536` KB)
  - Iterations: 3
  - Parallelism: 4
  - Hash Length: 32 bytes (256 bits)
  - Salt: 32 random bytes (256-bit salt)
- **PBKDF2 (Legacy Fallback & Migration)**:
  - 600,000 iterations, SHA-256, 32-byte salt.
  - Upon successful PBKDF2 unlock, Zup must silently perform **Double-Lock upgrade** to re-wrap MEK using Argon2id.

### Encryption Wrappers & Keychain Schema
The MEK is wrapped by a user-provided Master Password and/or WebAuthn passkeys:

```typescript
// Keychain Entry Format (f_keychain)
interface KeychainEntry {
  id: string;              // e.g. "keychain_${userId}_password" or "keychain_${userId}_${credId}"
  userId: string;
  type: 'password' | 'passkey';
  credentialId: string | null;
  wrappedKey: string;      // Base64 (16-byte IV + AES-GCM encrypted MEK)
  salt: string;            // Base64 (32-byte salt)
  isArgon: boolean;
  params: string;          // JSON string: {"memory":65536,"iterations":3,"parallelism":4,"algo":"Argon2id"}
  authPass?: boolean;
}
```

### Passkey Considerations & Quirks
- **WebAuthn PRF Extension**: Passkey wrapping uses the WebAuthn PRF (pseudo-random function) extension to derive a deterministic 256-bit key from the authenticator.
- **Domain RP ID Isolation**: WebAuthn credentials are bound strictly to origin (`rp.id`). Passkeys created on `zup.app` cannot decrypt keychain entries directly on `kylrix.space`. When Zup syncs a new account to Kylrix, password-wrapped MEK is synced; the user will set up domain-specific passkeys when visiting Kylrix directly.

### Mandatory In-Memory Roundtrip Validation
**Critical Requirement**: Before saving any newly encrypted MEK or data to disk/Appwrite, Zup MUST execute an immediate in-memory decryption test:

```typescript
const testDecrypted = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv },
  authKey,
  encryptedMek
);
if (!testDecrypted || testDecrypted.byteLength !== rawMek.byteLength) {
  throw new Error("KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation");
}
```

### Service Worker Volatile MEK Preservation ("Session Worker")
To prevent requiring the Master Password on every page refresh without persisting raw MEK to insecure `localStorage`:
- Zup holds the raw MEK in RAM inside `MasterPassCrypto` singleton.
- On page unload / reload, MEK is posted to a background Service Worker via `STORE_CONTEXT`.
- On startup, Zup attempts `RECOVER_CONTEXT` via Service Worker `MessageChannel`.
- Calling `lockApplication()` sends `WIPE_CONTEXT` to the Service Worker and purges memory.

### Synchronizing Encryption to a New Kylrix Account
If a Zup user creates or syncs to a brand-new Kylrix account directly from Zup:
1. Zup uses the local Master Password and Argon2id parameters to wrap the MEK.
2. Zup creates the `f_keychain` record in Appwrite.
3. Nostr private keys (`nsec`) are encrypted with MEK before saving to remote storage.

---

## 6. Relevant Tables & Schema Reference

Zup interacts with the following core Appwrite / RxDB tables:

| Table ID | Purpose | Key Columns |
|----------|---------|-------------|
| `f_keychain` | Zero-knowledge MEK wrappers | `userId`, `type`, `credentialId`, `wrappedKey`, `salt`, `isArgon`, `params` |
| `f_user_settings` | User app preferences & settings | `userId`, `theme`, `defaultRelays`, `feedSettings`, `activeNostrPubkey` |
| `f_nostr_identities` | Encrypted Nostr keypairs & metadata | `userId`, `pubkey`, `encryptedNsec`, `label`, `isPrimary` |
| `f_user_prefs` | Fast account-level flags | `userId`, `masterpass_setup`, `masterpass_for_login_enabled` |

---

## 7. Operational Summary & Common Pitfalls

1. **Never store raw `nsec` in unencrypted storage**: Always encrypt `nsec` with MEK (AES-GCM with fresh 96-bit IV) before writing to RxDB or Appwrite.
2. **Never wipe RxDB on OAuth logout**: Disconnecting Kylrix is an auth-state change, not a wipe-device command.
3. **Handle OAuth refresh token rotation**: Always capture the newly returned refresh token from Appwrite `/token` responses; reusing old refresh tokens will revoke the user's session.
4. **Strict Roundtrip Checks**: Always verify key wrapping with in-memory decryption before persisting.
5. **RxDB as Single Source of Truth**: UI components must never render directly from raw network responses; write to RxDB and let reactive queries drive the UI.
