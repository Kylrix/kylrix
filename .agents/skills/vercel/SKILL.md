---
name: vercel
description: >-
  Safe Vercel CLI workflows for Kylrix (inspect projects, logs, previews,
  deploys). Use when the user asks about Vercel, vercel CLI, production
  deploy, env vars on Vercel, or cloud hosting ops. Never mutate Vercel
  project env unless the user explicitly asks.
---

# Vercel CLI (safe ops)

## Hard rules

1. **Never touch Vercel env unless asked.** Do not run `vercel env add|rm|pull|push` against production/preview/development, and do not change dashboard secrets, unless the user explicitly requests it in the current message.
2. **Never invent production URLs or tokens.** Prefer `vercel whoami`, `vercel project ls`, and linked `.vercel` metadata.
3. **Prefer inspect over mutate.** Default to read-only: status, logs, list, inspect. Mutating commands (deploy, promote, rollback, domain, env) require an explicit user ask.
4. **Do not occupy local port 3005** or fight the user’s pinned Next.js process. Vercel CLI preview deploys are remote; local `pnpm dev` stays user-owned.
5. **Secrets stay local.** Never commit `.env`, `.env.local`, or `vercel env pull` output. Never paste production env values into git, PRs, or chat logs.
6. **Cloud ≠ rewrite local.** Localhost commerce uses `.env.local` (`PRICING_TIERS_ENABLED`, `NEXT_PUBLIC_PRICING_TIERS_ENABLED`, `SELFHOST_MODE=false`). Matching cloud behavior locally is an env-file change — **not** a Vercel change.

## When to use this skill

- User mentions Vercel, production deploy, preview deploy, build logs, domain, or CLI linking
- Debugging “works on cloud, fails locally” **hosting** issues (build, routes, serverless) — not Appwrite schema
- Checking whether a deploy finished / which alias is live

## Safe read-only commands

```bash
vercel whoami
vercel project ls
vercel ls                    # deployments for linked project
vercel inspect <url-or-id>
vercel logs <url-or-id>      # runtime logs (prefer recent window)
```

If the repo is not linked, ask before `vercel link` (it writes `.vercel/`).

## Mutating commands (explicit ask only)

| Task | Command pattern | Caution |
|------|-----------------|---------|
| Preview deploy | `vercel` | Creates a preview URL; fine for throwaway checks |
| Production deploy | `vercel --prod` | Ships to production aliases — confirm first |
| Promote / rollback | `vercel promote` / `vercel rollback` | Traffic-affecting |
| Domains | `vercel domains …` | DNS / alias impact |
| Env CRUD | `vercel env add\|rm\|pull\|push` | **Forbidden unless user asked** |

Always state which environment (production / preview / development) a mutate targets before running it.

## Local vs cloud billing gates

Checkout uses `isBillingCommerceEnabled()` (`lib/deployment/surface.ts`):

- Server: `PRICING_TIERS_ENABLED=true` **and** `SELFHOST_MODE` / `SELFHOSTED` not true
- Client: `NEXT_PUBLIC_PRICING_TIERS_ENABLED=true` **and** `NEXT_PUBLIC_SELFHOST_*` not true

Local dogfood of cloud pricing = flip those in **`.env.local`**, restart Next. Do **not** sync or rewrite Vercel project env to “fix localhost.”

## Related

- Billing flows: `billing.blockbee-pro`, `blockbee.hosted-checkout`
- Self-host product mode: `selfhost` (different from “I run Next on my laptop”)
