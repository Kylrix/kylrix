# Ecosystem read trough (single-tab SPA mirror cache)

Goal: minimize Appwrite / TablesDB **reads** across the unified `kylrix` app without perceptible UX change. Cross-app navigation should reuse in-memory (and bounded persisted) mirrors where canonical server truth allows — never persist decrypted Vault payloads.

## Phase A — Hot-path caches (in flight)

- [x] **Moment previews**: Persist attachment payloads (`attachedNote` / event / call) into preview seed + slim session persistence caps (`lib/moment-preview.ts`).
- [x] **Profile rows**: TTL + single-flight cache + upsert on create/update/discoverability (`lib/services/users.ts`), hook identity seed on mutations.
- [x] **Note rows (client)**: TTL + single-flight + tag pivot merged cache + invalidate on update/delete (`lib/appwrite/note.ts` — `invalidateNoteRowClientCache`).
- [x] **Identity staleness**: Relax default stale-before-background-refresh (`lib/identity-cache.ts`).

## Phase B — Coalesce & invalidate matrix

- [ ] Map **every mutation** that changes canonical rows to explicit invalidation or optimistic upsert (notes, moments, conversations, vault entries metadata-only).
- [ ] Align **list endpoints** with `appwrite.config.json` indexes — prefer `$id`-indexed reads over unconstrained `listRows`.
- [ ] **Vault**: cache ciphertext/metadata maps per unlocked session only; document MEK boundaries in code comments (no localStorage for decrypted secrets).
- [ ] **Chat / Connect threads**: message list dedupe + sliding TTL mirrors keyed by `conversationId`.
- [ ] **DataNexus / contexts**: audit TTL vs mutation hooks (`context/DataNexusContext.tsx`, Notes/Vault providers).

## Phase C — Verification

- [ ] Manual sweep: Feed → post detail → Note attachment opens **without redundant note `getRow`** when preview seeded from feed.
- [ ] Manual sweep: Connect → profile-heavy surfaces reuse **`UsersService.getProfileById`** cache across navigations.
- [ ] Spot-check hard reload: session-backed caches repopulate without stampedes (single-flight still wins).

---

_Archived (completed elsewhere): Accounts route normalization + internal API migration tracker._
