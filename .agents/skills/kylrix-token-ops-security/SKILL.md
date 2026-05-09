---
name: kylrix-token-ops-security
description: Hardens $KYLRIX token operations with append-only ledger discipline, singleton state-row gating, and server-admin security boundaries. Use when editing token mint/transfer/fine/claim logic, token APIs, or migration-to-onchain claim flows.
disable-model-invocation: true
---

# Kylrix Token Ops Security

## Scope

- `lib/services/internal/kylrix-token.ts`
- `app/(app)/(auth)/accounts/api/token/operations/route.ts`
- `lib/sdk/token/*` (contract + typed client wrapper)
- `appwrite.config.json` token ledger section (`kylrix_token_ledger`) when explicitly requested

## Non-negotiable rules

1. **Server-only mutations:** token mutations run through server SDK (`createAdminClient`) only; no client-side direct table writes.
2. **State-row gate first:** before any token operation (mint, transfer, fine, lock claim, settle claim, ledger reads that rely on initialized state), require the singleton state row and fail with `TOKEN_NOT_INITIALIZED` if absent.
3. **No implicit init:** initialization is explicit admin action only; operations must never auto-create state.
4. **Append-only events:** never overwrite historical token events; add new rows for each event.
5. **Idempotency required:** each mutation must include deterministic `idempotencyKey` and stable `txId` patterns.
6. **Admin auth:** privileged actions require authenticated account email to be present in `ADMINS` env list; do not rely on label-only checks.
7. **Least privilege responses:** only expose fields required by caller path; avoid leaking internal-only metadata.

## Ledger model

- One table: `chat.kylrix_token_ledger`
- Two row classes:
  - `rowType = event` (immutable operation log)
  - fixed singleton `rowId = state`, `rowType = state` (network totals / risk / contract version)
- Keep totals in state row for low-read paths; do not aggregate whole history for every request.

## Operation checklist

- [ ] Requester verified server-side (`verifyUser`).
- [ ] Admin path checks email against `ADMINS`.
- [ ] `requireStateRow()` called before operation logic.
- [ ] Input validated (non-empty ids, positive amounts, supported activity type).
- [ ] Idempotency duplicate path returns existing event safely.
- [ ] State row updated only for aggregate fields (minted, burned, circulating, root balance, risk).

## Migration readiness (future onchain)

1. `claim_lock`: debit user offchain balance and mark pending.
2. `claim_settled`: record onchain tx hash and adjust burned/circulating counters.
3. Keep offchain/onchain link data in event metadata (`destinationWallet`, `chain`, `onchainTxHash`).
