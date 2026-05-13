# Read Optimization TODO

- [ ] **Auth/session collapse**  
  Files: `context/AuthContext.tsx`, `context/auth/AuthContext.tsx`, `lib/appwrite/auth.ts`, `lib/check-session.ts`, `lib/finalizeAuth.ts`  
  Action: collapse repeated `getCurrentUser`/session verification into one cached snapshot with a single background refresh per route.

- [ ] **Profile hydration cache**  
  Files: `lib/services/users.ts`, `lib/profile-preview.ts`, `lib/profilePreview.ts`, `components/UserSearch.tsx`, `components/TopBarSearch.tsx`, `components/common/NoteTopbar.tsx`, `components/common/VaultTopbar.tsx`, `components/ReferralManager.tsx`, `components/ConnectedIdentities.tsx`, `components/ProfileManager.tsx`  
  Action: batch `getProfileById`, memoize avatar previews, and reuse a single identity cache across widgets.

- [ ] **Vault/masterpass reads**  
  Files: `lib/appwrite/vault.ts`, `lib/appwrite/keychain.ts`, `lib/ecosystem/security.ts`, `lib/masterpass-crypto.ts`, `lib/passkey.ts`, `components/common/SudoModal.tsx`, `components/overlays/SudoModal.tsx`, `components/common/PasskeySetup.tsx`, `components/overlays/PasskeySetup.tsx`, `components/MasterPassManager.tsx`  
  Action: stop repeated keychain presence checks and expose one unlock state snapshot for the whole route.

- [ ] **Connect/chat coalescing**  
  Files: `lib/services/chat.ts`, `components/chat/ChatWindow.tsx`, `components/chat/ChatList.tsx`, `components/chat/ConversationActionsSheet.tsx`, `components/providers/ChatNotificationProvider.tsx`, `app/(app)/connect/chats/page.tsx`, `app/(app)/connect/chat/[id]/page.tsx`, `app/(app)/(auth)/accounts/api/connect/*`  
  Action: keep conversation base/member/message caches warm, reuse prefetched rows, and batch participant/profile hydration.

- [ ] **Note/social/feed reuse**  
  Files: `lib/appwrite/note.ts`, `context/NotesContext.tsx`, `lib/services/social.ts`, `lib/moment-preview.ts`, `lib/moment-thread-cache.ts`, `lib/ecosystem/tablesdb-row-cache.ts`, `components/ui/NoteCard.tsx`, `components/ui/NoteDetailSidebar.tsx`, `components/landing/GhostEditor.tsx`, `components/landing/GhostNoteClaimer.tsx`, `app/(app)/note/*`  
  Action: avoid duplicate note row reads when moving from feed to detail and keep attachment/thread caches hot.

- [ ] **Flow/task list snapshots**  
  Files: `lib/services/forms.ts`, `context/TaskContext.tsx`, `lib/kylrixflow.ts`, `lib/services/internal/engagement-views.ts`, `app/(app)/flow/*`  
  Action: use indexed reads only, coalesce refreshes, and snapshot task/event summaries per route.

- [ ] **Wallet/billing state**  
  Files: `lib/services/wallets.ts`, `lib/services/token.ts`, `lib/services/internal/kylrix-token.ts`, `lib/billing/*`, `context/subscription/*`, `lib/subscription/*`, `app/(app)/(auth)/accounts/subscription/*`, `components/WalletManager.tsx`, `components/SendReceiveClient.tsx`  
  Action: read balances and entitlement once per route and fan the result out to all consumers.

- [ ] **Search/activity/agentic pressure**  
  Files: `lib/services/contacts.ts`, `lib/services/activity.ts`, `lib/services/agentic.ts`, `lib/services/ecosystem.ts`, `lib/services/storage.ts`, `lib/services/call.ts`, `lib/services/internal/*`, `app/(app)/(auth)/accounts/api/account-events/route.ts`, `app/(app)/(auth)/accounts/api/pro/notify/route.ts`, `app/(app)/(auth)/accounts/api/reports/route.ts`  
  Action: add single-flight list fetches and stop polling the same Appwrite tables from multiple surfaces.

- [ ] **Server bridge consolidation**  
  Files: `lib/appwrite-server.ts`, `lib/appwrite-admin.ts`, `lib/server/api.ts`, `app/api/*`, `app/(app)/(auth)/accounts/api/*`  
  Action: fan out less, return shaped payloads, and hydrate multiple UI widgets from one server response.

