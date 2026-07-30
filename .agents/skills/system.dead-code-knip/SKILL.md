---
name: system.dead-code-knip
description: Aggressively remove unused files/exports with Knip and intra-file dead locals with ESLint. Use for LOC cuts and post-refactor cleanup.
---

# Dead code: Knip + ESLint

## Split of responsibility

| Tool | Catches |
|------|---------|
| **Knip** | Dead files, unused `export` symbols, unused npm deps |
| **ESLint `no-unused-vars`** | Unexported locals / unused params **inside** a file |

Knip follows `import`/`export` only. A private function never called in its own file is an ESLint concern, not Knip.

## Config

- `knip.json` — Next entrypoints under `app/**`, project globs for `app|components|context|hooks|lib|theme`
- Protected / ignored modules (token & billing must not be auto-deleted):
  - `lib/billing/subscription-service.ts`
  - `lib/services/web3-wallets.ts`
  - `lib/app-origin.ts`
  - `lib/services/internal/admin-guard.ts`
- False-positive deps to keep: `dexie` (RxDB), `tailwindcss`, `cross-env`

## Safe workflow

```bash
pnpm exec knip --include files,exports,types,dependencies
pnpm exec knip --fix --fix-type exports,types   # strips unused export keywords
pnpm exec tsc --noEmit
pnpm build
```

## Danger zones

1. **Do not** delete OpenBricks icon/primitive aliases blindly — many are MUI-compat names still imported.
2. **Do not** auto-delete modules only referenced from knip-ignored billing/token files.
3. **Do not** enable `@typescript-eslint/no-unused-vars` as a warn in default `pnpm lint` — warning flood exceeds `--max-warnings 50`. Use a one-off eslint rule for cleanup campaigns.
4. Prefer deleting whole dead files over stripping exports that are part of a public SDK surface you still intend to grow.

## After large `--fix` runs

Always `pnpm exec tsc --noEmit` and `pnpm build`. Restore any false-positive export strips immediately.
