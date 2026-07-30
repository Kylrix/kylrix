# Kylrix agent skills catalog

**Read this file first.** Then open only the one skill that matches your task. Do not browse the directory skill-by-skill.

Hard policy also lives in repo-root `AGENTS.md` (Table/Row terms, single DB `passwordManagerDb`, no new in-app `app/api` routes, pnpm only, `/flows` + `/workspaces` routing).

_Catalog covers 86 skills._

## How to pick a skill

1. Guardrails → `kylrix-guardrails`
2. Routes / nav → `system.routing-canonical`, `system.navigation-policy`
3. Dead code / LOC → `system.dead-code-knip`
4. Domain work → matching prefix (`security.*`, `note.*`, `call.*`, `billing.*`, …)
5. Product “why” → `why.*` (rationale only; still follow implementation skills for code)

## Start here

| Skill | Helps with |
|-------|------------|
| `kylrix-guardrails` | Enforces Kylrix safety and architecture rules in the single Next.js codebase. Use before editing app logic, data flows, shared services, or cross-app UX. |

## Architecture & routing

| Skill | Helps with |
|-------|------------|
| `system.navigation-policy` | Enforces same-tab navigation and canonical route helpers. Use when editing links, redirects, shell transitions, or chrome active states. |
| `system.routing-canonical` | Canonical Kylrix App Router paths after the scorched-earth route wipe. Use before adding links, redirects, nav items, or isXPath helpers. |

## Security & crypto

| Skill | Helps with |
|-------|------------|
| `security.agentic-execution-safety` | Deep dive into the Agentic AI execution and sandbox safety engine in Kylrix. Explains the strict ownership checking, Google Gemini API parameters, and framework |
| `security.auth-lifecycle-guardrails` | "Prevents interactivity issues caused by unauthorized background tasks. Use when background services (like cleanup or sync tasks) throw 'Unauthorized' errors on |
| `security.database-read-only-rls` | Explains why database-level ACL permissions are strictly read-only, how the Server SDK dynamically escalates write access using userId/creatorId and global coll |
| `security.kylrix-integrity` | Integrity checks and trust boundaries for Kylrix secure operations and shared objects. |
| `security.masterpass-crypto` | Deep dive into the cryptographic architecture powering the Kylrix secure state vault. Explains Argon2id key stretching, PBKDF2 legacy migrations, and AES-GCM cr |
| `security.mfa-session-verification` | Deep dive into the temporal Multi-Factor Authentication (MFA) session verification in Kylrix. Explains factor normalization, temporal alignment (mfaUpdatedAt vs |
| `security.permission-system` | Procedural guide for the Kylrix privileged permission system. Explains the relationship between the Actor ID, JWT auth fail-safe, and the Admin SDK adapter. Use |
| `security.privileged-permissions` | Deep dive into the user visibility levels and Row-Level Security (RLS) system in Kylrix. Explains the permissions mapping matrix, and server-side privileged per |
| `security.public-and-guest` | Native isPublic / isGuest / isGeneral columns as server-side escape hatches for sharing. |
| `security.rate-limiting-bruteforce` | Deep dive into the client-side memory-based rate limiter and the server-side progressive auth rate limiter. Explains user pattern learning, email verification o |
| `security.secure-ops-rls-bypass` | Explains the hybrid Row-Level Security (RLS) system in secure-ops, detailing how user-scoped fetches fallback to dynamic admin verification gates. |
| `security.sudo-mode-gate` | Deep dive into the temporal Sudo Mode validation in Kylrix. Explains the RAM-only timestamp window, non-persistence policies, and multi-factor authorization bou |
| `security.vault-keychain` | Applies zero-knowledge security constraints to masterpass, passkeys, keychain, credentials, and TOTP flows. Use for unlock/reset/wipe/security-critical logic. |
| `security.wesp-security-context` | Deep dive into the Web Ecosystem Security Protocol (WESP) in Kylrix. Explains tab-specific RAM-only secrets, system-wide lock broadcasts, and key isolation to b |

## Data, sync & Appwrite

| Skill | Helps with |
|-------|------------|
| `rxdb-appwrite-sync` | RxDB/IndexedDB substrate for local-first storage. For object list/detail sync architecture (pendingSync, upsert merge, detail-must-not-autosave), follow the can |
| `rxdb-local-storage-only` | Strict mandate that all local copy engine operations must use RxDB / IndexedDB substrate (LocalEngine / getRxDB) and avoid browser localStorage. |
| `storage.core` | Ecosystem standards and architectural rules for file uploads, size gating, client-side compression, and dynamic rendering across all Kylrix storage buckets. |
| `storage.upload-gating` | Deep dive into the server-side file upload security engine in Kylrix. Explains the subscription plan gates, bucket-level byte ceilings, and Next.js Server Actio |
| `sync` | Canonical offline-first local-copy sync for Kylrix. Live copy = UI content SoT; autonomic sync engine pending queue (RxDB) = amber/green SoT; Appwrite confirms  |
| `system.appwrite-audit` | Audits table/index usage against live schema config without proposing schema edits. Use when validating data flow, query alignment, and stale table assumptions. |
| `system.appwrite-cli-ops` | Guide for Appwrite CLI operations, especially table creation and schema management. Always check CLI version first. Use when creating tables, columns, indexes,  |
| `system.chat-relay-relay` | Deep dive into the server-side real-time chat sync and event propagation. Explains conversation member permission mappings, SHA-256 base64url reaction indexing, |
| `system.cross-app-linking` | Maintains cross-app pointers and metadata links between notes, tasks, calls, and secure objects. Use when connecting features across domain surfaces without dup |
| `system.domain-canonicalization` | Enforce using the canonical www.kylrix.space subdomain for all outgoing URLs, email CTAs, Telegram push messages, share links, and public metadata assets. Use w |
| `system.ghost-send` | Intricacies and architectural mandates for the Unified Send (Ghost Relay) system. Explains the 7-day auto-clearing polymorphic relay, zero-idle onboarding, and  |
| `system.hexagonal-registry` | Deep dive into the dynamic Dependency Injection (DI) registry in Kylrix. Explains port/adapter decoupling, lazy instantiation, and run-time mock overrides for t |
| `system.join-request-gating` | Deep dive into the Group Join Request system in Kylrix. Explains the composite-key SHA-256 ID derivation, invite link expiration verification, and admin-only no |
| `system.query-expression-mapping` | Deep dive into the database query mapper in Kylrix. Explains how clean QueryExpressions (e.g. equal, contains, limit) are mapped to database-specific formats to |
| `system.sdk-consistency` | Keeps shared sdk/service contracts consistent across the single codebase. Use when editing `lib/sdk`, shared exports, or broad consumer callsites. |
| `system.server-sdk-action` | Server Actions vs Admin SDK patterns for privileged TablesDB mutations. |
| `system.tablesdb-row-cache` | Explains the read-through caching engine for TablesDB. Explains key hashing, cache eviction schedules, and coalescing concurrent inflight queries to prevent net |

## Connect / calls

| Skill | Helps with |
|-------|------------|
| `call.presence-heartbeat-mesh` | Deep dive into the real-time presence and typing indicators in Kylrix. Explains the ephemeral presence channels, table-scoped resource bindings, and broadcast l |
| `call.webrtc-huddles` | Deep dive into the WebRTC real-time calls and audio/video mesh architecture in Kylrix. Explains direct P2P vs Cloudflare SFU transport modes, device dynamic hot |

## Notes & objects

| Skill | Helps with |
|-------|------------|
| `note.crosslinks-tagging` | Deep dive into the tag-prefix relational mapping pattern in Kylrix. Explains how crosslink tags (e.g. `source:kylrixnote:id`) represent relationships without co |
| `note.decoupled-sdk` | Deep dive into the platform-agnostic Notes SDK structure. Explains the injection pattern, isolation of database queries, and modular mock compatibility. |
| `note.filtering` | Foundation for note discovery and partitioning in the Kylrix ecosystem. Use this to ensure notes are correctly routed between the primary Notes list, Shared Pri |
| `note.ghost-threads` | Guidelines and lifecycle rules for using Ghost Notes as a high-efficiency comment and chat thread channel across Kylrix resources (calls, tasks, tags, projects, |
| `note.shared-cache` | Share note state globally via RxDB/NotesContext instead of making redundant network fetches. Ensure once notes are loaded/synced in /note, they are locally quer |

## Workspaces & Flow

| Skill | Helps with |
|-------|------------|
| `flow.cascading-on-demand` | The Cascading-on-Demand (CoD) CRUD optimization pattern for extremely snappy rendering and highly efficient data/permission queries in the Kylrix ecosystem. Use |
| `flow.drafts-autosave-recovery` | Deep dive into the localized form drafts autosave and manifest tracking in Kylrix. Explains the uncommitted state persistence, metadata segregation, and storage |
| `flow.realtime-input-rxdb-sync` | Realtime form/input sync through RxDB local copy before Appwrite confirm. |
| `workspace.projects-table` | Workspaces UI over the projects table (ProjectsService). Use when editing /workspaces, project detail, discussion, or project-linked objects. |

## Billing & tokens

| Skill | Helps with |
|-------|------------|
| `billing.blockbee-pro` | Kylrix Pro/Teams billing via BlockBee hosted checkout, coupons, and subscription ledger. Use for pricing, checkout, success, and admin Pro grants. |
| `blockbee.hosted-checkout` | BlockBee hosted checkout for Pro/Teams billing. Use when editing pricing, checkout server actions, BlockBee URLs, IPN fulfillment, or yearly discount charging. |
| `system.token-ledger-minting` | Explains the internal Kylrix Token ledger architecture. Explains micro-denomination conversions, supply restrictions, risk tightening, and activity-based mint d |
| `token.ops-security` | Hardens $KYLRIX token operations with append-only ledger discipline, singleton state-row gating, and server-admin security boundaries. Use when editing token mi |

## UI / brand

| Skill | Helps with |
|-------|------------|
| `brand.general` | A dark-only brand language system for Kylrix-style products. Use to define or critique UI tone, spacing, chrome, accent color direction, and the openbricks syst |
| `brand.kylrix` | Applies Kylrix brand language (logo, palette, typography, surface hierarchy) while preserving readability and UX clarity. Use for top-level UI visual decisions. |
| `brand.openbricks-3.0` | Unified OpenBricks 3.0 specifications combining tactile depth, glow dynamics, micro-interactions, minimal contextual copy, and strict sectional hierarchy. |
| `colors` | Canonical color map specifications for the Kylrix ecosystem, restricting all interfaces to five core branding hues plus neutral accents. |
| `copy.plain-language` | Enforces plain, user-facing language and blocks jargon-heavy product copy. Use when UI text drifts into buzzwords, metaphors, or internal terminology that users |
| `ui.drawer` | Applies drawer-first interaction patterns for secondary actions, pickers, and in-context workflows. Use when replacing modal-heavy flows or stabilizing drawer U |
| `ui.drawer-sidebar-desktop-translation` | Direct layout translation of mobile drawers into unified desktop sidebars. Outlines rules for anchor placement, dimensions, stacking behavior, and responsive CS |
| `ui.fluid-layouts` | Unified specifications for dynamic, responsive canvas layouts. Explains the deprecation of rigid multi-column sections in favor of fluid UI morphs that adapt se |
| `ui.global-hud` | Handles global activity HUD behavior, unread/read pointers, and transient presence signals. Use for topbar/live activity indicators and ecosystem notification s |
| `ui.interaction-design` | Expert architectural patterns for maintaining UI responsiveness and preventing 'click-blocking' in complex mono-apps. Use when refactoring layouts, adding globa |
| `ui.interactivity-safety` | Expert guidance for maintaining UI interactivity and preventing 'Stacking Context traps' in the Kylrix mono-app. Use when modifying global layouts, adding new d |
| `ui.render-glitch-detector` | Diagnose and fix React rendering glitches caused by real-time subscriptions, animation loops, and GPU-intensive operations. Detects infinite re-subscription cyc |
| `ui.skeleton-philosophy` | Skeleton loading patterns for perceived performance without layout thrash. |
| `ui.tailwind-fix` | Row and card text layout fixes after Tailwind v4 + OpenBricks migration. Use when list rows, cards, or drawer items have clipped text, crushed line-height, or c |
| `ui.tailwind-v4` | Tailwind v4 + OpenBricks migration notes for utility and theme tokens. |

## Agentic

| Skill | Helps with |
|-------|------------|
| `agentic.runtime` | In-app agent runtime (settings agents, chat/session routes, tool registry, client executor). Use when editing agent drawers, tools, or session UX. |

## Why (product rationale)

| Skill | Helps with |
|-------|------------|
| `why.cascade-delete-mechanic` | Explains the asynchronous and recursive cascade deletion logic designed to purge linked metadata, comment reactions, and storage voice files. |
| `why.engagement-audit-views` | Deep dive into the dynamic engagement views and metric rollup architecture in Kylrix. Explains the SHA-256 salted IP/UserAgent anonymization, daily/monthly buck |
| `why.exportability-data-sovereignty` | Explain why all user data is completely portable (importable/exportable) and how our Google integration promotes ultimate user data sovereignty. |
| `why.free-tier-limits-8-collaborators` | Explain why databases, notes, passwords, forms, and TOTPs are completely free and unlimited, but capped at 8 collaborators per resource to avoid undocumented re |
| `why.group-calls-cap-16` | Explain the strict 16-member limit on Hangouts (groups) and Calls to prevent Appwrite read-permission bloat, WebSocket lag, and typing indicator overhead, along |
| `why.ispublic-isguest-escape-hatches` | Detail the isPublic, isGuest, and isGeneral columns that serve as secure server-side escape hatches to manage resource access for public, guest, and project con |
| `why.scrapped-byok-ai` | Document the architectural decision to scrap the Bring Your Own Key (BYOK) AI model in Kylrix, explaining the conflicts with E2EE boundaries, decryption key UX, |
| `why.telegram-notification-bridge` | Explain using Telegram as a push notification outlet to remain completely detached from Apple/Google developer platform constraints and fee structures. |
| `why.universal-identity-hook` | Deep dive into the global Connect Directory profile and identity sync system. Explains sync event routing, caching layers, and cross-application identity lookup |
| `why.unlock-upgrade-t5` | Explain the single Kylrix Pro subscription model, the symbolism of crypto-only payment, detachment from corporate compliance bloat, and the exclusion of Teams f |
| `why.unorganic-email-dispatch` | Deep dive into the Unorganic Email Dispatch engine in Kylrix. Explains the prioritized event queue, theme mappings, anti-spam frequency caps, and ledger logging |
| `why.ux-vs-encryption-balance` | Detail the balance between client-side end-to-end encryption and server-side encryption, highlighting why normal notes are server-side encrypted to prioritize r |
| `why.workflow-engine` | Deep dive into the declarative workflow and task engine in Kylrix. Explains the reversible negations catalog, irreversible actions safety list, hierarchical Act |
| `why.zero-support-passkeys` | Explain the "Zero-Support" philosophy and why passkeys are heavily incentivized to mathematically prevent account lockouts. |

## Ops & shipping

| Skill | Helps with |
|-------|------------|
| `ota` | "Use when working on anything Ota-specific: creating, refining, reviewing, or explaining Ota contracts (`ota.yaml`), modeling execution governance for humans an |
| `schema-mismatch-audit` | Procedure for aligning database schema mismatches where client code attempts to push fields missing in Appwrite config and production. |
| `shipping-mode` | Guidelines for ultra-high velocity shipping in the Kylrix organization. |
| `system.build-errors` | Known Next/tsc build failure modes and the fastest surgical fixes. |
| `system.dead-code-knip` | Aggressively remove unused files/exports with Knip and intra-file dead locals with ESLint. Use for LOC cuts and post-refactor cleanup. |

## Vendor / SDK references

| Skill | Helps with |
|-------|------------|
| `appwrite-cli` | Appwrite CLI skill. Use when managing Appwrite projects from the command line. Covers installation, login, project initialization, multi-file project configurat |
| `appwrite-typescript` | Appwrite TypeScript SDK skill. Use when building browser-based JavaScript/TypeScript apps, React Native mobile apps, or server-side Node.js/Deno backends with A |

## Removed / do not resurrect

Retired during the 2026 route & architecture wipe (or replaced):

- `system.accounts-api`, `system.router` — accounts shell & meta-router gone
- `brand.openbricks`, `brand.openbricks-2.1` — use `brand.openbricks-3.0`
- `call.realtime`, `call.presence-mesh` — use `call.webrtc-huddles` + `call.presence-heartbeat-mesh`
- `flow.tasks`, `note.intelligence` — superseded by routing + domain skills
- `ui.gpu-compositor-feed-stability`, `ui.muted-v3-design` — obsolete surfaces
- `upstash/` vendor dump — not Kylrix product skills
- `why.projects-ecosystem-flagship` → `workspace.projects-table`
- `agentic.universal-tooling` → `agentic.runtime`
- Loose `blockbee.custom-flow.md`, `tailwind-fix-v2.md` — retired / merged

