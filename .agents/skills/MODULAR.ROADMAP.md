# Modularization and Code Reduction Roadmap (`MODULAR.ROADMAP.md`)

## Core Objectives

1. **Aggressive Modularization:** Decouple monolithic domains into strictly bounded, self-contained packages/modules with zero circular dependencies and explicit public interfaces.
2. **Minimalist LOC (Lines of Code):** Eliminate redundant abstractions, wrapper bloat, and duplicated logic to achieve the minimum conceptual LOC necessary.
3. **Behavioral Invariant:** Zero regression. Every existing feature, local-first storage mechanism, zero-knowledge vault operation, MCP bridge, and agent workflow must function identically to the pre-refactor state.
4. **Self-Tracking Execution:** Progress must be recorded directly within this roadmap file as tasks are completed to eliminate duplication and track incremental state.

---

## Phase 1: Codebase Mapping & Dependency Auditing

*Status: Completed*

* [x] **1.1 Symbol & Dependency Graph Analysis**
* Run static analysis to map current cross-module imports, circular dependencies, and high-coupling zones. (Completed: Mapped core boundaries across Storage, Auth/Crypto, Entities, API/Transport, UI, and MCP).
* Identify and isolate the core domain boundaries (Persistence/Storage, Auth/Crypto, Domain Entities, API/Transport, UI Primitives, Agent/MCP Runtimes).


* [x] **1.2 Dead Code & Bloat Identification**
* Identify unreferenced exports, legacy compatibility layers, and redundant helper utilities. (Completed via `knip` audit: identified unused exports/types, duplicate exports, and legacy alias layers).


* [x] **1.3 Test Baseline Verification**
* Ensure existing test suites or functional smoke tests pass cleanly to establish the invariant anchor. (Verified: `pnpm run lint` and `pnpm exec vitest run` passed 70 test suites, 527 tests).



---

## Phase 2: Domain Isolation & Decoupling

*Status: Pending*

* [ ] **2.1 Storage & Persistence Layer**
* Consolidate database drivers, query builders, and migration logic into a single, isolated persistence module.
* Expose a clean, agnostic repository interface to the rest of the application.


* [ ] **2.2 Cryptography & Security Layer**
* Isolate zero-knowledge encryption primitives (e.g., envelope encryption, key derivation) into an independent, zero-side-effect module.


* [ ] **2.3 Core Entities & Business Logic**
* Strip business domain models (Notes, Goals, Workspaces, Vault items) of UI-specific properties and framework bindings.


* [ ] **2.4 Transport, API, & MCP Bridges**
* Decouple routing, HTTP/RPC handlers, and Model Context Protocol (MCP) server bindings from internal business logic.


* [ ] **2.5 UI Primitives & Presentation Layer**
* Ensure UI components consume only explicit domain contracts and design tokens without leaking state management into persistence layers.



---

## Phase 3: Radical Code Reduction (LOC Minimization)

*Status: Pending*

* [ ] **3.1 Elimination of Abstraction Tax**
* Replace overly engineered factory patterns, unnecessary wrapper classes, and redundant indirection with direct, idiomatic implementations.


* [ ] **3.2 Utility & Helper Flattening**
* Purge generalized `utils/` or `helpers/` graveyards; relocate domain-specific utilities directly into their respective modules or inline where trivial.


* [ ] **3.3 Dependency Slimming**
* Evaluate external dependencies and replace bloated packages with lean native implementations or standard library features wherever feasible.



---

## Phase 4: Verification & Invariant Checks

*Status: Pending*

* [ ] **4.1 Full Feature Smoke Test**
* Verify local-first data persistence, sync, vault decryption, and agent execution paths.


* [ ] **4.2 LOC Delta Audit**
* Measure total code reduction and document architectural metrics.



---

## Progress Ledger & Execution Log

*Use this section to record completed items, commit references, and structural notes during execution to prevent repetition.*

| Phase / Task ID | Status | Timestamp / Commit | Notes & Observations |
| --- | --- | --- | --- |
| Task 1.1 | Completed | Phase 1 | Symbol & dependency graph mapped; domain boundaries isolated (Storage: `lib/db`/`lib/data`, Auth/Crypto: `lib/vault`/`context/vault-context`, API/Transport: `app/api`/`lib/realtime`, MCP: `lib/mcp`/`mcp`). |
| Task 1.2 | Completed | Phase 1 | Dead code and bloat analysis completed using `knip`. Cataloged unused exports, duplicate legacy exports (`isValidAppwriteRowId`, `useAppwriteVault`), and unreferenced types for Phase 2/3 cleanup. |
| Task 1.3 | Completed | Baseline | Test suites (`vitest` 70/70 suites, 527 tests) and ESLint (`pnpm run lint`) verified passing cleanly. |
