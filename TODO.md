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

## Phase D — Appwrite read minimization backlog

This pass targets the worst repeated reads across auth, profiles, chat, notes, vault, flow, wallet, billing, search, activity, and server bridges. The goal is to replace repeated per-component `getRow`/`listRows` calls with single-flight caches, TTL snapshots, indexed lookups, and prehydrated route payloads.

- **Auth/session**: `context/AuthContext.tsx`, `context/auth/AuthContext.tsx`, `lib/appwrite/auth.ts`, `lib/check-session.ts`, `lib/finalizeAuth.ts` should share one session probe and one cached user/profile snapshot instead of each surface asking Appwrite separately.
- **Profiles/search**: `lib/services/users.ts`, `lib/profile-preview.ts`, `lib/profilePreview.ts`, `components/UserSearch.tsx`, `components/TopBarSearch.tsx`, `components/common/NoteTopbar.tsx`, `components/common/VaultTopbar.tsx`, `components/ReferralManager.tsx`, `components/ConnectedIdentities.tsx`, `components/ProfileManager.tsx` need batched profile hydration, TTL avatar cache, and a single-flight `getProfileById` path.
- **Vault/masterpass**: `lib/appwrite/vault.ts`, `lib/appwrite/keychain.ts`, `lib/ecosystem/security.ts`, `lib/masterpass-crypto.ts`, `lib/passkey.ts`, `components/common/SudoModal.tsx`, `components/overlays/SudoModal.tsx`, `components/common/PasskeySetup.tsx`, `components/overlays/PasskeySetup.tsx`, `components/MasterPassManager.tsx` should collapse repeated `listKeychainEntries` and masterpass checks into one unlock snapshot per route/session.
- **Connect/chat**: `lib/services/chat.ts`, `components/chat/ChatWindow.tsx`, `components/chat/ChatList.tsx`, `components/chat/ConversationActionsSheet.tsx`, `components/providers/ChatNotificationProvider.tsx`, `app/(app)/connect/chats/page.tsx`, `app/(app)/connect/chat/[id]/page.tsx`, `app/(app)/(auth)/accounts/api/connect/*` should keep conversation base/member/message caches warm, reuse prefetched rows, and stop re-reading profiles for each thread transition.
- **Note/social/feed**: `lib/appwrite/note.ts`, `context/NotesContext.tsx`, `lib/services/social.ts`, `lib/moment-preview.ts`, `lib/moment-thread-cache.ts`, `lib/ecosystem/tablesdb-row-cache.ts`, `components/ui/NoteCard.tsx`, `components/ui/NoteDetailSidebar.tsx`, `components/landing/GhostEditor.tsx`, `components/landing/GhostNoteClaimer.tsx`, `app/(app)/note/*` should avoid duplicate note row reads during feed -> detail navigation.
- **Flow/tasks/forms/events**: `lib/services/forms.ts`, `context/TaskContext.tsx`, `lib/kylrixflow.ts`, `lib/services/internal/engagement-views.ts`, `app/(app)/flow/*` need indexed list reads, per-route snapshots, and debounce/coalesce on refresh.
- **Wallet/billing/subscription**: `lib/services/wallets.ts`, `lib/services/token.ts`, `lib/services/internal/kylrix-token.ts`, `lib/billing/*`, `context/subscription/*`, `lib/subscription/*`, `app/(app)/(auth)/accounts/subscription/*`, `components/WalletManager.tsx`, `components/SendReceiveClient.tsx` should read balances, entitlement, and activity once per route and reuse the snapshot across subcomponents.
- **Search/activity/agentic**: `lib/services/contacts.ts`, `lib/services/activity.ts`, `lib/services/agentic.ts`, `lib/services/ecosystem.ts`, `lib/services/storage.ts`, `lib/services/call.ts`, `lib/services/internal/*`, `app/(app)/(auth)/accounts/api/account-events/route.ts`, `app/(app)/(auth)/accounts/api/pro/notify/route.ts`, `app/(app)/(auth)/accounts/api/reports/route.ts` should add single-flight lists and stop polling the same Appwrite tables from multiple widgets.
- **Server bridges/routes**: `lib/appwrite-server.ts`, `lib/appwrite-admin.ts`, `lib/server/api.ts`, `app/api/*`, `app/(app)/(auth)/accounts/api/*` should fan out less and return shaped payloads that hydrate multiple UI pieces at once.

Detailed task notes and progress tracking live in `cache/read-optimise/`.
