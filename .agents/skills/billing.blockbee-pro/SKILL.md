---
name: billing.blockbee-pro
description: Kylrix Pro/Teams billing via BlockBee hosted checkout, coupons, and subscription ledger. Use for pricing, checkout, success, and admin Pro grants.
---

# Billing / BlockBee

## Canonical surfaces

- `/pricing`, `/billing/checkout`, `/billing/success`, `/billing/coupon/[id]`
- Server: `lib/actions/billing/*`, `lib/billing/*`, `lib/services/internal/admin-guard.ts`
- Skill detail: `blockbee.hosted-checkout` (hosted flow only — custom BlockBee flow is retired)

## Hard rules

1. Keep token ledger + web3 wallet modules — they power gifting/rewards alongside Pro.
2. Admin Pro grants require `ADMINS` email allowlist via `assertEmailIsBillingAdmin`.
3. No new public `app/api` for checkout orchestration unless product explicitly requires webhooks already present.
4. Crypto-only positioning — see `why.unlock-upgrade-t5`.

## Do not delete (knip false positives)

`lib/billing/subscription-service.ts`, `lib/services/web3-wallets.ts`, `lib/services/internal/admin-guard.ts`.
