# KylrixOrganization - Organizaion Local Agent Guide

# AGENTS.md - System Orchestration

## Core Operational Directives
1. You are an autonomous software engineering agent tasked with maintaining the [Project Name] ecosystem.
2. Your development workflow is strictly governed by financial and performance budgets detailed in `TOKENS.md`.

## Execution Lifecycle
*   **Phase 1 (Bootstrap):** On initialization, read `TOKENS.md` once to configure your output parser and tool-selection priority weights.
*   **Phase 2 (Execution):** Maintain those constraints across all loop iterations. If your context window approaches 80% capacity, execute a self-directed context summary pass using the guidelines in `TOKENS.md`.

## 🏗️ Architectural Mandates

### 🚫 IMMUTABLE FILES (STRICT)
- **No internal APIs**: DO NOT introduce new HTTP API routes/endpoints (`app/api/*`, `route.ts`) for in-app flows. This Организация Организации keeps zero extra attack surface and no unnecessary latency.
- **Prefer Internal Methods**: Use existing in-process functions, Server Actions, and SDK helpers instead of exposing new API surfaces.
- **Data Consolidation**: When returning shaped payloads to hydrate multiple UI widgets, use Server Actions or consolidated internal service methods.

### ✅ SOURCE CONTROL PERMISSIONS
- **Git Operations Permitted**: The agent is permitted and expected to perform Git operations. After implementing any fix or feature, the agent must consolidate the modifications, perform a commit with a descriptive message, and push the changes immediately.
- **Pure Commit Messages (STRICT)**: When committing, NEVER add any co-author metadata (e.g., `Co-authored-by:` headers, names, or emails). Commit messages must contain only the pure commit message description. Leave author identification entirely to the automatic system git configuration.

### ⚡ Development Standards
- **Canonical App**: Only implement against **`kylrix/`**. Legacy trees at repo root are for reference only.
- **Tailwind CSS**: Use Tailwind CSS and Vanilla CSS for maximum flexibility and modern looks according to openbricks design language. MUI and its co-dependencies are deprecated and must be removed.
- **Opaque Surfaces**: No gradients or translucent backgrounds on product chrome.
- **PNPM Only**: Always use `pnpm` for package management. NEVER use `npm` or `yarn`.
- **Global Unmount Policy**: Strictly use conditional rendering (`{isOpen && <Component />}`) for all overlays (drawers, modals, sidebars) instead of relying on visibility props. This physically removes the component and its invisible backdrops from the DOM when closed, mathematically preventing interaction blocking.
- **Interactivity Standards**: Use `keepMounted: false` and `disablePortal: true` for all OpenBricks drawers/modals to ensure they stay contained and cleanup correctly.
- **Surgical Execution**: For 'surgical fixes', prioritize direct, high-precision code modifications. Skip build/lint/test cycles unless explicitly instructed to validate. Aim for maximum velocity in resolving identified issues. Sometimes you only run `pnpm lint` or nothing at all (instead of running lint and build all the time), especially for minor edits, feature additions, or changes with low LOC and low chances of introducing new bugs.
- **Zero Speculation**: When the user identifies a specific error (ReferenceError, SyntaxError, etc.), fix exactly that error and stop. DO NOT check for similar errors in other files or attempt to 'proactively find' related issues. Resolve the reported problem surgically and get out of the way immediately.
- **Layman-First**: Prohibit technical jargon (e.g., E2EE, Entropy, Node, Nexus, Decentralized, Agentic) in all UI copy and descriptions. Use simple, direct, layman-friendly English (e.g., Secure, Private, System, Smart). Prioritize accessibility and user adoption over technical metaphors.
- **Terminology Mandate (STRICT)**: Use **"Table"** instead of "Collection" and **"Row"** instead of "Document" in all code, comments, logs, and internal documentation. The Appwrite-native "document" and "collection" terms are deprecated and must never be reintroduced. This applies to method names (e.g., `listRows` over `listDocuments`), variable names, and UI copy.
- **Single Database Mandate**: Kylrix uses a single-database design where all tables exist inside a single Appwrite database ID: `passwordManagerDb` (as defined in `appwrite.config.json`). References to `whisperrflow` or any database ID other than `passwordManagerDb` are invalid and will fail runtime execution. Ensure all database operations target `passwordManagerDb` or use the configuration constants.

