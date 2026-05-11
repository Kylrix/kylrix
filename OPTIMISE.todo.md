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

---

## Phase 9 — Persistent Chrome Unification (PCU): single mount, app-aware skin

**Mission:** the topbar, bottom bar, sidebar, FABs and overlay drawers must mount **exactly once** for the whole session. App switches (note ↔ vault ↔ flow ↔ connect ↔ accounts) must only swap **content & skin** (logo, accent, nav items, action slots), never the React component identity, never the DOM nodes. Marketing routes must reuse the same chrome with the same identity, only changing skin.

**Production invariant:** _no functionality regression_. Every change verified by `tsc`, lint of touched files, and a full `next build`. Any consumer of the affected component must keep its existing imports working through compatibility re-exports during the transition.

### Map of current fragmentation (audit, do NOT delete yet)

| Concern | Files involved | Status |
|---|---|---|
| **Topbar** | `components/common/NoteTopbar.tsx` (1842L, live), `components/common/VaultTopbar.tsx` (live), `components/UnifiedTopbar.tsx` (dispatcher, live), `components/Navbar.tsx` (live on `/pitch`,`/apps`,`/products`,`/sdk`,`/downloads`), `components/Topbar.tsx` (verify usage), `components/AppHeader.tsx`, `components/layout/AppBar.tsx`, `components/layout/AppHeader.tsx`, `components/layout/Header.tsx`, `components/layout/Navbar.tsx`, `components/layout/ConnectTopbar.tsx`, `components/layout/TopbarShell.tsx`, `accounts/components/Topbar.tsx`, `accounts/components/layout/AppHeader.tsx`, `accounts/components/layout/TopbarShell.tsx` | Fragmented |
| **Topbar mount points** | `GlobalShell` (website routes), `app/(app)/layout.tsx` (app routes via `UnifiedTopbar`), page-local `<Navbar />` on marketing pages | Multiple |
| **Bottom bar** | `components/UnifiedBottomBar.tsx` (live, in GlobalShell), `components/layout/BottomNav.tsx` (re-mounted by MainLayout & vault AppShell), MUI bottom nav also re-rendered inside `vault/AppShell.tsx` | Doubled on flow/connect dashboard, vault |
| **Sidebar** | `Navigation.DesktopSidebar` (live, in GlobalShell), `DynamicSidebar` (live, in GlobalShell), `components/layout/Sidebar` (mounted by MainLayout), `components/layout/RightSidebar` (mounted by MainLayout), `vault/AppShell` inline sidebar | Doubled on flow/connect/vault |
| **FAB** | `components/layout/GlobalFAB.tsx` (in MainLayout), `components/layout/VaultFAB.tsx`, `components/ui/QuickCreateFab.tsx`, `components/MobileFAB.tsx`, `components/chat/ChatQuickActionsFab.tsx` | Fragmented |
| **Layout wrappers** | `MainLayout` (flow+connect dashboards), `vault/AppShell` (vault), `AppLayoutContent` (note), `accounts/layout.tsx` (accounts), `components/layout/ConnectAppShell.tsx` (no-op fragment!) | Inconsistent |
| **EcosystemPortal** | `components/common/EcosystemPortal.tsx` (canonical), `components/EcosystemPortal.tsx`, `accounts/components/EcosystemPortal.tsx` | Duplicates |
| **Duplicate identity/profile/passkey UI** | `components/MasterPassManager.tsx` vs `accounts/components/MasterPassManager.tsx`, `WalletManager`, `SessionsManager`, `PinManager`, `ProfileManager`, `ConnectedIdentities`, `IdentityBadge`, `ActivityLogs`, `PasskeySetup` vs `passkeySetup` | Forked pairs |

### P9-Hoist — single mount point for chrome

- [x] **P9-H1.** Hoist `UnifiedTopbar` out of `app/(app)/layout.tsx` and into `GlobalShell` so the topbar is mounted **once** for both website and app routes. Component identity must stay the same across pathname changes within the same auth-source family (`useAuth` vs `useAppwriteVault`).
- [x] **P9-H2.** Slim `app/(app)/layout.tsx` to a pure pass-through (`{children}`) so it doesn't re-create a wrapping `<Box>` that participates in DOM diff churn.
- [ ] **P9-H3.** Add `<PersistentChromeSlot zone="topbar"|"bottombar"|"sidebar"|"fab">` so each chrome region has one stable React node. App-context drives only the **inner skin** via memoized props, not the wrapper component type.
- [ ] **P9-H4.** Make `UnifiedTopbar` reuse the **same JSX element type** across all non-vault apps (it already does via `NoteTopbar`). For vault, render `NoteTopbar` as the structural shell with a `<VaultIdentitySlot />` swap — so even vault→note doesn't remount the bar.

### P9-Strip — neutralize duplicate chrome wrappers

- [x] **P9-S1.** Convert `components/layout/MainLayout.tsx` into a thin pass-through that **does not** mount Sidebar/RightSidebar/GlobalFAB/TaskDialog (those live in `GlobalShell` / context-driven slots already). Keep `MainLayout` export so existing `flow/(dashboard)/layout.tsx` and `connect/(dashboard)/layout.tsx` imports keep working; behavior change is internal.
- [x] **P9-S2.** `components/layout/ConnectAppShell.tsx` is a no-op fragment — keep the export as a thin pass-through, mark deprecated; remove only after all `import { ConnectAppShell }` sites are migrated.
- [ ] **P9-S3.** Move vault-specific sidebar & bottom nav logic from `components/layout/AppShell.tsx` into the universal chrome configs (driven by app context). Then make `AppShell` a pass-through too; keep the named export for backwards compatibility.
- [ ] **P9-S4.** Marketing pages (`/pitch`, `/apps`, `/products`, `/sdk`, `/downloads`): currently render their own `<Navbar />` while `GlobalShell` also renders `NoteTopbar`. Decide one source of truth: prefer the **universal topbar**; convert marketing pages to remove the local `<Navbar />` import (or scope GlobalShell to *not* render a topbar on these exact routes, whichever is less risky). Keep both renderable behind a feature flag during rollout.

### P9-DRY — universal config-driven skin

- [ ] **P9-D1.** Add `lib/chrome/app-context.ts` exporting:
  - `resolveAppContext(pathname): { app: 'note'|'vault'|'flow'|'connect'|'accounts'|'settings'|'marketing'; accent: string; logoVariant; navItems: NavItem[]; topbarSkin: TopbarSkin; bottomNavItems: NavItem[]; }`
  - Single source of truth for accent colors (currently duplicated in `UnifiedBottomBar`, `getAppColor`, `getAppTone`).
- [ ] **P9-D2.** Refactor `UnifiedBottomBar` to read its tabs/colors from `resolveAppContext` instead of an inline `if/else` ladder; same for `UnifiedTopbar`.
- [ ] **P9-D3.** Extract `<TopbarLogoSlot />` (intelligent: app-derived), `<TopbarSearchSlot />`, `<TopbarActionSlot />`, `<TopbarProfileSlot />` as memoized sub-components so the chrome only re-renders the slots that changed when navigating.
- [ ] **P9-D4.** Replace `framer-motion` usage in topbars with **CSS keyframes / transitions** for the simple enter/exit cases (logo glow, drawer slide) — keeps chrome free of the 50KB motion bundle. Reserve `motion` for in-page surfaces only.

### P9-Dead — purge proven-unreferenced chrome files (only after migration)

- [ ] **P9-X1.** After P9-D2/D3 land, ripgrep-confirm zero references and delete: `components/Topbar.tsx`, `components/AppHeader.tsx`, `components/layout/AppHeader.tsx`, `components/layout/Header.tsx`, `components/layout/Navbar.tsx`, `components/layout/ConnectTopbar.tsx`, `components/layout/TopbarShell.tsx`, `components/layout/AppBar.tsx`, `components/AppHeader.tsx`, `components/ui/appShell.tsx`, `accounts/components/Topbar.tsx`, `accounts/components/layout/AppHeader.tsx`, `accounts/components/layout/TopbarShell.tsx`.
- [ ] **P9-X2.** Same for FABs: `components/MobileFAB.tsx`, `components/layout/GlobalFAB.tsx`, `components/layout/VaultFAB.tsx`, `components/ui/QuickCreateFab.tsx`, `components/chat/ChatQuickActionsFab.tsx` — reduce to one `<UniversalFAB />` driven by app context.
- [ ] **P9-X3.** EcosystemPortal duplicates: delete `components/EcosystemPortal.tsx` and `accounts/components/EcosystemPortal.tsx`; keep `components/common/EcosystemPortal.tsx`.
- [ ] **P9-X4.** Duplicated identity/profile/passkey UI pairs — keep `accounts/components/*` as canonical (they're the most maintained set) and replace root duplicates with re-exports. Then delete originals.
- [ ] **P9-X5.** Delete `app/(app)/(auth)/accounts/login/page.tsx.bak`.

### P9-Verify

- [ ] **P9-V1.** Manual smoke after each hoist/strip: (1) website root, (2) `/note/notes`, (3) `/vault/dashboard`, (4) `/flow`, (5) `/connect`, (6) `/accounts` — confirm exactly **one** topbar, **one** bottom bar (where applicable), **one** sidebar, **one** FAB.
- [ ] **P9-V2.** Use the React DevTools profiler on a route hop (`/note/notes → /vault/dashboard → /connect/chats`) to assert the topbar component instance ID is **stable** (no unmount log) when same auth-source family.
- [ ] **P9-V3.** `tsc --noEmit` + `pnpm run build` + lint of every touched file are non-negotiable gates between each step.

---

