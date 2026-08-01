---
name: flow.schema-install-review
description: >-
  Flow tables (workflows + flow_installs + flow_reviews), object bindings,
  install-count secure punch, and publish review gate. Use when changing flow
  schema, installs, scopes, or publish verification.
---

# Flow schema & secure punches

## Tables (`passwordManagerDb`)

| Table | Role |
|-------|------|
| `workflows` | Definition JSON + denormalized `installCount`, `reviewStatus`, `toolTierMax`, `flowKind`, `ownerId`, `verifiedKind` |
| `flow_installs` | One row per installer×scope (unique `flowId+installerId+scopeKey`) |
| `flow_reviews` | Publish gate audit (verdict, findings, PII summary) |
| `objects` | Bindings: `childKind=flow`, `childId=workflowId`, parent = host |

**Additive only** — never mutate/delete existing columns (see `system.appwrite-cli-ops`).

## Install punch

1. Authenticated actor creates **their** `flow_installs` row (RLS owner).
2. On **first** create only, system client increments `workflows.installCount` (strangers never get write on the author’s row).
3. Optional `objects` bind via `lib/flows/bindings.ts` (`buildFlowScopeKey`).

Entry: `installFlowSecure` → `FlowInstallService.install`.

## Publish punch

`requestFlowPublishSecure` → `FlowReviewService.requestPublishReview`:

- Always writes `flow_reviews` + sets `reviewStatus=pending`.
- Auto-approve **only** `toolTierMax=general` and no PII.
- Fine/system / PII → stays pending for agentic investigation.
- System tier never publishable.

## Scopes

`user` | `object` | `kind` | `all` → normalized `scopeKey` for unique index + object metadata.
