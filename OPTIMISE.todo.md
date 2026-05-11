# OPTIMISE.todo.md — Surgical build/modularity backlog

**Purpose:** Reduce compile/build wall-clock and module-graph pressure while preserving behavior.  

**Truth gate (read first):** “Mathematically zero broken functionality” is **not obtainable** for a whole app without a formal proof system. This list uses **measurable baselines + typed gates + prioritized manual/regression QA** so each step is reversible and attributable.

---

## Phase 0 — Baseline & budgets (blocking)

- [ ] **P0-B1.** Add a single **build metrics script** checked into repo docs (not necessarily CI): record `pnpm build` duration, `.next/` output size (or Turbopack report if available), and `tsc --noEmit` duration separately; store last 5 runs in a local log or CI artifact naming convention (`build-metrics-YYYYMMDD-HHMM.txt`).
- [ ] **P0-B2.** Run `@next/bundle-analyzer` (already in devDependencies) on **production analyze** builds and capture **top 15 modules** per client/server chunk; attach snapshot path in this doc’s appendix comment.
- [ ] **P0-B3.** Document **cold vs warm** builds: delete `.next` once, time cold; rerun without delete, time warm. Many wins only affect cold paths; Turbopack already shifts the bottleneck.
- [ ] **P0-B4.** Set an explicit **target**: e.g. “−30% prod `next build` on CI” vs “−30% incremental `tsc`.” **10× entire-repo build time** is usually **infeasible** without splitting repos/packages or massively deleting scope—flag as “only via structural split,” not JSX refactors alone.

---

## Phase 1 — Dead graph & duplicate surface (cheap wins, low breakage risk)

- [ ] **P1-D1.** `components/Providers.tsx` appears **unreferenced** by imports—verify via ripgrep / TS project references; if unused, delete or explicitly mark deprecated single entry to avoid drift **vs** `app/ClientProviders.tsx` (the live root shell).
- [ ] **P1-D2.** Reconcile **`EcosystemPortal`** loading: `GlobalShortcuts.tsx` lazy-loads it while `components/Providers.tsx` (if kept) eagerly imported—ensure exactly **one** inclusion path in production tree (`ClientProviders` + `GlobalShell` hierarchy); duplicate mount can mean duplicate realtime/subscription listeners.
- [ ] **P1-D3.** Duplicate component filenames (same concern, merge or re-export from one canonical path): examples seen in tree—`WalletManager.tsx` (root vs `accounts/components`), `MasterPassManager`, `SessionsManager`, `PasskeySetup` / `passkeySetup`, `EcosystemPortal` (common vs accounts), multiple `IdentityBadge`/`GlobalSearch`/modal variants. For each pair: confirm which route bundles import which file; consolidate to **one** implementation and thin wrappers only where props differ.
- [ ] **P1-D4.** `app/(app)/(auth)/accounts/providers.tsx` plus `app/(app)/vault/providers.tsx` vs root `ClientProviders.tsx`: map **every** layout that wraps `Providers`; eliminate nested duplicate `NotesProvider` / `NotificationProvider` / `SubscriptionProvider` stacks (risk: double fetch, double subscriptions).
- [ ] **P1-D5.** Purge orphaned `*.bak` (e.g. `login/page.tsx.bak`) from `app/`—they still expand search noise and confuse agents.

---

## Phase 2 — TypeScript throughput (often 20–40% of “slow feels”)

- [ ] **P2-T1.** Profile `tsc --noEmit --extendedDiagnostics --generateTrace ./ts-trace` on main; inspect hottest files (usually mega-context files like `TaskContext.tsx`, large route pages).
- [ ] **P2-T2.** Split **`context/TaskContext.tsx`** (and similar 1k+ line contexts) into `TaskStateContext`, `TaskActionsContext`, `TaskRealtimeContext` modules re-exporting a composed provider—**no behavior change**, only file boundaries, to improve incremental typecheck and IDE.
- [ ] **P2-T3.** Replace `any` hotspots in hot paths with narrow types incrementally (reduces inference work); batch by directory (`context/`, `lib/sdk/`).
- [ ] **P2-T4.** Ensure `tsconfig` `include` does not pull **tests** into app typecheck if excluded—already excludes `*.test.ts`; verify no stray `**/*.ts` in tooling globs doubles work.

---

## Phase 3 — Next.js config & bundler hints (Turbopack-safe items)

- [ ] **P3-N1.** Expand `next.config.js` with **`modularizeImports`** for `@mui/material` and `@mui/icons-material` (per Next docs) to dedupe deep import paths—**verify** no missing icon re-exports in edge builds.
- [ ] **P3-N2.** Add `experimental.optimizePackageImports: ['@mui/material', '@mui/icons-material', 'lodash', 'date-fns', 'lucide-react']` (validate against Next 16 support matrix—fallback if incompatible).
- [ ] **P3-N3.** Audit **`server-only`** consumers: `@simplewebauthn/server`, `node-appwrite`, `stripe`, etc. must not leak into client graphs; fix boundary imports where violations exist (drops client bundle work).
- [ ] **P3-N4.** Identify routes using `force-dynamic` / uncached fetch—necessary ones stay; accidental ones inflate build/runtime work; gate with product owner per route subtree (`app/`).

---

## Phase 4 — Heavy dependency fences (behavior-preserving laziness)

- [ ] **P4-H1.** **Solana (`@solana/web3.js`) / Sui (`@mysten/sui`) / `ethers`**—ensure entry only via **dynamic `import()`** inside wallet/token flows actually used from UI; verify tree still resolves for SSR (no referenceError on idle routes).
- [ ] **P4-H2.** **Markdown/remark pipeline** (`react-markdown` + plugins)—lazy-load editors/preview surfaces that aren’t needed on landing shell; parity check: rendered HTML identical for golden markdown fixtures (store 3–5 snapshot strings in tests).
- [ ] **P4-H3.** **`framer-motion`**—scope to discrete components; avoid importing in top-level shells if unused on initial paint.
- [ ] **P4-H4.** **`RxDB`**—if used, confirm duplicate init cannot happen across remount paths; singleton module pattern.

---

## Phase 5 — DRY modularization targets (cross-cutting libs)

- [ ] **P5-R1.** `lib/sdk/index.ts` **barrel** re-exports entire surface—incrementally add **subpath exports** in `package.json` (`"exports"` map) or enforce lint rule “no importing from `@/lib/sdk` root; use `@/lib/sdk/ecosystem` etc.” to shrink consumer parse graphs.
- [ ] **P5-R2.** `lib/appwrite/index.ts` barrel—same treatment; server actions should import minimal modules.
- [ ] **P5-R3.** Centralize **Appwrite realtime channel strings** (NotesContext still references `.collections.${...}.documents`; confirm TablesDB path parity elsewhere) into one `lib/appwrite/channels.ts` to reduce drift and duplicated subscription logic—not a perf win alone, lowers duplicate-runtime risk when tightening subscriptions.
- [ ] **P5-R4.** Theme: root layout loads **two** font pipelines—`next/font` JetBrains Mono **and** Fontshare external CSS (`Clash Display`, `Satoshi`). Decide: consolidate to **all `next/font`** or **document** why duplicate is required; external CSS blocks optimization and duplicates download paths.

---

## Phase 6 — Verification pyramid (closest thing to “no breakage proof”)

- [ ] **P6-V1.** **Smoke route list** automated: Playwright (or existing runner) hitting `/`, `/note/...`, `/vault/...`, `/flow/...`, `/connect/...`, `/accounts/...`, one **shared note** fixture, **ghost** landing if applicable—minimal assertions (HTTP 200, no console errors).
- [ ] **P6-V2.** **Golden tests** for crypto helpers (derive, wrap/unwrap mocks) where deterministic.
- [ ] **P6-V3.** **Contract tests** against Appwrite **mock** layer for SDK serialization (payload shape regressions)—only if mocks exist today; otherwise mark as Phase 8 investment.
- [ ] **P6-V4.** **Rollback rule:** any Phase 4+ change merges only with **before/after analyzer diff** archived.

---

## Phase 7 — CI & cache (often the real 2–5× CI win)

- [ ] **P7-C1.** **pnpm store** cache + `.next/cache` persistence on CI keyed by lockfile hash.
- [ ] **P7-C2.** Split jobs: **`lint`** / **`typecheck`** / **`build`** parallel (if not already)—wall-clock dominates perception.
- [ ] **P7-C3.** Remote build cache (**Turborepo** or vendor remote cache)—only if repo becomes multi-package; aligns with wholesale `libs/*` extraction.

---

## Phase 8 — Structural split (only path toward extreme multipliers)

- [ ] **P8-S1.** Extract **`@kylrix/vault-kit`**, **`@kylrix/note-editor`**, **`@kylrix/connect-ui`** workspace packages—with **explicit public APIs**—so `pnpm build --filter=kylrix` typechecks fewer files per incremental change.
- [ ] **P8-S2.** Move **marketing/landing** to separate deployable OR static-export subtree to decouple SaaS shells from ISR/marketing churn.

---

## Appendix — Signals observed in codebase (anchors for above)

| Signal | Location / note |
|--------|------------------|
| Default `next.config.js` only sets `typescript.tsconfigPath` | `next.config.js` |
| Root uses `ClientProviders` with deep provider nesting | `app/layout.tsx`, `app/ClientProviders.tsx` |
| Alternate `Providers` composition exists | `components/Providers.tsx`; verify unused |
| Some dynamic splitting already (`MainLayout`, `GlobalShortcuts`) | `components/layout/MainLayout.tsx`, `components/GlobalShortcuts.tsx` |
| Widespread `@mui/icons-material` imports | Many files (~100+) — prioritize modularizeImports |
| Large contexts | `context/TaskContext.tsx` etc. |

---

_Last updated from a repo survey in-workspace; reconcile file paths line counts if refactors move modules._
