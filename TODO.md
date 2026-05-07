# Accounts Translation + API Calcification Tracker

## Phase 0 - Baseline Inventory and Mapping
- [x] Build route inventory for `app/(app)/(auth)/accounts/api/**`
- [x] Build in-repo consumer map for `/api/*` usage
- [x] Freeze migration matrix and statuses

### API Migration Matrix
| API route | Current consumers | Target internal method/service | Consumer migration | API deletion |
| --- | --- | --- | --- | --- |
| `/api/permissions` | `lib/services/chat.ts`, `lib/appwrite/note.ts`, `components/landing/GhostNoteClaimer.tsx` | `lib/services/internal/permissions.ts` | in_progress | pending |
| `/api/connect/messages` | `lib/services/chat.ts` | `ChatService.sendMessageInternal` | in_progress | pending |
| `/api/connect/message-reactions` | `lib/services/chat.ts` | `ChatService.reactToMessageInternal` | in_progress | pending |
| `/api/connect/join-requests` | `lib/services/chat.ts`, `app/(app)/connect/groups/invite/[conversationId]/page.tsx` | `lib/services/internal/joinRequests.ts` | in_progress | pending |
| `/api/connect/repair` | `lib/services/chat.ts` | `lib/services/internal/connectRepair.ts` | in_progress | pending |
| `/api/connect/group-avatar` | `lib/services/chat.ts` | `lib/services/internal/connectAvatar.ts` | pending | pending |
| `/api/billing/checkout` | `app/(app)/(auth)/accounts/subscription/pro/checkout/page.tsx` | `lib/services/internal/billing.ts` | pending | pending |
| `/api/billing/coupons/claim` | `app/(app)/(auth)/accounts/coupon/[id]/page.tsx` | `lib/services/internal/billing.ts` | pending | pending |
| `/api/admin/stats` | `app/(app)/(auth)/accounts/admin/page.tsx` | `lib/services/internal/admin.ts` | pending | pending |
| `/api/admin/users` | `app/(app)/(auth)/accounts/admin/users/page.tsx`, `app/(app)/(auth)/accounts/admin/emails/page.tsx` | `lib/services/internal/admin.ts` | pending | pending |
| `/api/admin/coupons` | `app/(app)/(auth)/accounts/admin/coupons/page.tsx` | `lib/services/internal/admin.ts` | pending | pending |
| `/api/admin/emails/send` | `app/(app)/(auth)/accounts/admin/emails/page.tsx` | `lib/services/internal/admin.ts` | pending | pending |
| `/api/emails` | `lib/email-notifications.ts`, `api/connect/join-requests/route.ts` | `lib/services/internal/emailDispatch.ts` | in_progress | pending |
| `/api/reports` | no in-repo callers found | `lib/services/internal/reports.ts` | pending | pending |
| `/api/referrals` | no in-repo callers found | `lib/services/internal/referrals.ts` | pending | pending |
| `/api/account-events` | no in-repo callers found | `lib/services/internal/accountEvents.ts` | pending | pending |
| `/api/pro/notify` | no in-repo callers found | `lib/services/internal/proNotifications.ts` | pending | pending |
| `/api/auth/session` | no in-repo callers found | `lib/services/internal/session.ts` | pending | pending |
| `/api/notes/[noteid]/share` | no in-repo callers found | `lib/services/internal/noteShare.ts` | pending | pending |
| `/api/connect/conversations` | no in-repo callers found | `lib/services/internal/conversations.ts` | pending | pending |
| `/api/connect/calls/cleanup` | no in-repo callers found | `lib/services/internal/callCleanup.ts` | pending | pending |

## Phase 1 - `/accounts/**` Route Parity
- [ ] Normalize links in `app/(app)/(auth)/accounts/**` to canonical `/accounts/...` paths
- [ ] Remove residual unprefixed accounts navigation (`/login`, `/admin`, `/settings`, `/pro/success`)
- [ ] Ensure pricing/subscription links resolve to `/accounts/subscription/pro/checkout` and `/accounts/pro/success`

## Phase 2 - Internal Service Layer
- [ ] Add `lib/services/internal/permissions.ts` (shared permission mutation methods)
- [ ] Add `lib/services/internal/joinRequests.ts` (GET/POST/PATCH/DELETE join-request logic)
- [ ] Add `lib/services/internal/emailDispatch.ts` (non-HTTP email dispatch wrapper)
- [ ] Add `lib/services/internal/admin.ts` + `billing.ts` (admin/billing callable methods)
- [ ] Refactor route handlers to thin wrappers over these methods

## Phase 3 - Consumer Rewire
- [ ] Rewire `lib/services/chat.ts` off `KYLRIX_AUTH_URI/api/connect/*` + `/api/permissions`
- [ ] Rewire `app/(app)/connect/groups/invite/[conversationId]/page.tsx` off join-request API fetches
- [ ] Rewire `lib/email-notifications.ts` to internal dispatch method
- [ ] Rewire note permission callers (`lib/appwrite/note.ts`, `GhostNoteClaimer.tsx`) to internal permission methods where server-safe

## Phase 4 - Security Hardening
- [ ] Centralize admin guards in internal admin service methods
- [ ] Ensure server-only internal modules for privileged mutations
- [ ] Verify no client component imports privileged service modules directly

## Phase 5 - Billing/Subscription Integrity
- [ ] Keep checkout/coupon claim behavior parity
- [ ] Ensure idempotent coupon-apply and subscription activation flow
- [ ] Keep `/pricing` -> `/accounts/...` transitions stable

## Phase 6 - Env Consolidation
- [ ] Create `kylrix/.env`
- [ ] Merge and dedupe keys from `accounts/.env`, `note/.env`, `flow/.env`, `vault/.env`, `connect/.env`
- [ ] Track key conflicts here (names only; no secret values)

## Phase 7 - API Shutdown
- [ ] Remove deprecated accounts API handlers after rewires complete
- [ ] Keep only required external callback endpoints (if any)

## Phase 8 - Final Sweep
- [ ] Remove remaining in-app `/api/*` and `KYLRIX_AUTH_URI/api/*` dependencies
- [ ] Validate connect invite/chat/call flows on internal methods
- [ ] Validate accounts admin/settings/subscription against new internal paths
- [ ] Mark residual risk items
