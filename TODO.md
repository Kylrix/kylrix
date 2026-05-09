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
- [x] **Vault**: `listAllCredentials` / `listTOTPSecrets` — in-flight dedupe + defensive clones on cache hits; locks clear inflight (`lib/appwrite/vault.ts`).
- [x] **Chat threads**: concurrent `getMessages` coalescing + inflight bust on wipe/delete (`lib/services/chat.ts`).
- [x] **Social attachments**: TablesDB row read-through cache for note/event/call resolves + note mutations invalidate mirrored Tables row (`lib/ecosystem/tablesdb-row-cache.ts`, `lib/services/social.ts`, `invalidateNoteRowClientCache`).
- [x] **DataNexus / contexts**: cross-layer `publishNexusInvalidate` + provider listener; `invalidate` drops in-flight promises (`context/DataNexusContext.tsx`, `lib/ecosystem/nexus-bridge.ts`).
- [x] **Connect conversations**: `getConversationById` caches hydrated row (45s) + coalesce; bypass + bust on mutations (`lib/services/chat.ts`).
- [x] **Connect inbox list**: `getConversations` snapshot TTL (~40s) + single-flight; bust on sends/wipes/edits/deletes/vault-lock (`lib/services/chat.ts`).
- [x] **Notes feed Nexus**: debounced invalidation of `initial_notes_*` on realtime updates; immediate on create/delete + local upsert/remove (`context/NotesContext.tsx`).
- [x] **Chat thread reads**: `getMessages(..., { prefetchedConversation })` skips redundant `getConversationById`/decrypt when the UI already has the row (`ChatWindow`, `ChatList`, `ChatNotificationProvider`; `lib/services/chat.ts`).
- [x] **Nexus background mirror**: `refreshInBackground` (separate flight map) + profile warm path (`DataNexusContext.tsx`, `ProfileProvider.tsx`); `ChatList` coalesces overlapping `loadConversations` calls.

## Phase C — Verification

- [ ] Manual sweep: Feed → post detail → Note attachment opens **without redundant note `getRow`** when preview seeded from feed.
- [ ] Manual sweep: Connect → profile-heavy surfaces reuse **`UsersService.getProfileById`** cache across navigations.
- [ ] Spot-check hard reload: session-backed caches repopulate without stampedes (single-flight still wins).

---

_Archived (completed elsewhere): Accounts route normalization + internal API migration tracker._
