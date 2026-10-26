# Billing, Subscriptions & Entitlements Architecture

This document details the billing architecture, crypto payment infrastructure via BlockBee, subscription tier resolution rules, entitlement policies, and coupon claim state synchronization.

---

## 💳 Payment Provider Infrastructure (BlockBee)

Kylrix uses **BlockBee** as its primary payment infrastructure for subscriptions, crypto payments, and billing checkouts (`lib/billing/providers/blockbee.ts`).

- **Payment Flow:**
  1. User initiates checkout via `createBillingCheckoutSessionAction` (`lib/actions/billing/billing.ts`).
  2. BlockBee generates a crypto checkout session or direct payment URL.
  3. Webhook events arrive at `/api/v1/billing/webhook/blockbee` and are verified using HMAC signatures (`blockbee-webhook-verify.ts`).
  4. Successful payments update the user's subscription record in Turso SQLite (`subscription` table) and invalidate cached entitlement states (`invalidateEntitlementCache`).

---

## 🎖️ Subscription Tiers & Resolution Rules

User subscription tiers are evaluated globally across the application (`getUserSubscriptionTier` in `lib/utils.ts`):

| Tier Code | Name | Description | Pro Perks Granted? | Badge / Avatar Ring |
|---|---|---|---|---|
| `FREE` | Free | Standard tier for free users. | No | Default |
| `CONTRIBUTOR` | Contributor | Granted automatically to verified open-source GitHub contributors. | **Yes** | Active Pro Avatar Ring |
| `PRO` | Pro | Individual paid subscription. | **Yes** | Active Pro Avatar Ring |
| `TEAMS` | Teams | Team workspace subscription. | **Yes** | Active Pro Avatar Ring |
| `ORG` | Organization | Enterprise & organization subscription. | **Yes** | Active Pro Avatar Ring |
| `LIFETIME` | Lifetime | Lifetime access tier. | **Yes** | Active Pro Avatar Ring |

### Contributor Tier Auto-Grant (`isContributor`)
In `lib/actions/contributor-ops.ts`, user GitHub accounts linked in the `account` table are queried. If the user has merged pull requests or commits in the repository:
- `isContributor` is set to `true` in `schema.user`.
- `getUserSubscriptionTier` resolves `CONTRIBUTOR` tier, granting full Pro feature access globally across topbar, sidebar, and drawers.

---

## 🏷️ Coupon Redemption Pipeline

Coupon resolution and redemption (`claimCouponAction` and `createBillingCheckoutSessionAction`) operate directly on Turso SQLite as the primary datasource (`getCouponTurso`, `listCouponsTurso`, `upsertCouponTurso`):

1. **Turso Primary Query:** Admin-minted coupons in Turso SQLite are queried first.
2. **Redemption Check:** Checks `redemptionCount < redemptionLimit` and expiration date.
3. **Atomic Incrementation:** On claim, `redemptionCount` is atomically incremented in Turso SQLite, ensuring redemption states remain synchronized across sessions.

---

## 🔐 Entitlement Policy Enforcement

Entitlements are checked client-side and server-side (`lib/services/internal/subscription-entitlement.ts`):

- **Share & Access Controls:** In `ShareLockButton.tsx` and `UnifiedDrawerContext.tsx`, share actions (`share-note`, `share-context`, `access-control`, `ecosystem-send`) check plan status:
  - Unauthenticated users $\rightarrow$ Open Auth drawer (`login`).
  - Free plan users $\rightarrow$ Open Upgrade drawer (`pro-upgrade`).
  - Pro / Contributor / Teams / Lifetime users $\rightarrow$ Proceed to share drawer.
- **Entitlement Invalidation:** Subscription mutations invalidate `invalidateEntitlementCache(userId)` to ensure immediate entitlement recalculation without page reloads.
