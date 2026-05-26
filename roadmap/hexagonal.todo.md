# Kylrix Hexagonal Backend Architecture Roadmap ⬢

This roadmap details the milestones and actionable items required to transition Kylrix's backend into a fully decoupled, swappable **Hexagonal Architecture (Ports & Adapters)**. The design ensures that the core business logic remains completely technology-agnostic (blind to whether it connects to Appwrite, Supabase, AWS, SQLite, or PostgreSQL) while preserving 100% production stability and zero disruption to current users.

---

## 🏗️ Architectural Foundations & Port Interfaces

- [ ] **Directory Setup**: Create a pristine architectural workspace under `lib/core/`
  - `lib/core/ports/` — Declared TypeScript interfaces defining capabilities (Outbound/SPI).
  - `lib/core/adapters/` — Implementations mapping adapters to specific infrastructure.
  - `lib/core/di/` — Central Dependency Injection / Service Registry.
- [ ] **Define Database Port**: Create `lib/core/ports/database.port.ts`
  - Implement strict terminology: Use `getRow`, `listRows`, `createRow`, `updateRow`, and `deleteRow`.
  - Design a technology-agnostic `QueryFilter` abstraction to bypass leaking Appwrite-specific queries into the core domain.
- [ ] **Define Auth Port**: Create `lib/core/ports/auth.port.ts`
  - Declare standard Actor discovery bounds to fetch session verification keys.
  - Return a unified `Actor` profile interface containing user IDs, administrative flags, and status.
- [ ] **Define Storage Port**: Create `lib/core/ports/storage.port.ts`
  - Standardize file uploads, download URL generation, and object deletions.
  - Standardize metadata, file-size gating, and bucket identifiers.
- [ ] **Define Functions & Messaging Ports**:
  - `lib/core/ports/functions.port.ts` — Standard execution layer for background runs.
  - `lib/core/ports/messaging.port.ts` — Standard email dispatch.

---

## 🔌 Concrete Adapters (Infrastructure Layer)

- [ ] **Implement Appwrite Database Adapter**:
  - Implement `AppwriteDatabaseAdapter` calling Appwrite's database and TablesDB layers.
  - Map clean domain `QueryFilter` structures dynamically to Appwrite `Query` constants.
  - Integrate existing performance boosters like the 5-second in-memory `rowCache` cleanly.
- [ ] **Implement Appwrite Auth Adapter**:
  - Implement `AppwriteAuthAdapter` consuming user sessions securely.
  - Retain full backwards compatibility with current multi-name cookie discovery (`a_session_*`, `session`).
- [ ] **Implement Appwrite Storage Adapter**:
  - Implement `AppwriteStorageAdapter` for file operations.
  - Respect bucket-specific limits (e.g. 1MB profile pictures, 5MB attachments) and format restrictions on the server side.
- [ ] **Implement Appwrite Functions & Messaging Adapters**:
  - Create execution wrappers for running cloud scripts and dispatching SMTP notifications via the Appwrite Messaging client.

---

## 🎛️ Dependency Injection & Service Registry

- [ ] **Create DI Locator**: Create `lib/core/di/registry.ts`
  - Coordinate outbound port implementations under a single Registry.
  - Default all resolutions to Appwrite concrete adapters.
  - Support runtime overrides (e.g., `Registry.overrideStorage(new AWSS3Adapter())`) for isolated testing and future hybrid/swapped stack orchestrations.

---

## 🔄 Surgical Refactoring & Cutlery Safety

- [ ] **Refactor Core Server Actions**:
  - Replace direct imports of Appwrite SDK and server clients in `lib/actions/secure-ops.ts` with calls resolved via `Registry.getDatabase()` and `Registry.getAuth()`.
  - Keep internal CRUD payloads and schemas identical, ensuring zero impact on live data.
- [ ] **Refactor Storage Gateways**:
  - Transition file managers like `secure-upload.ts` to consume the `Registry.getStorage()` interface.
- [ ] **Refactor Ecosystem Internal Services**:
  - Migrate internal service files in `lib/services/internal/` (e.g. `permissions.ts`, `kylrix-token.ts`, `billing.ts`) to depend solely on Ports.
  - Enforce strict terminology in all comments, logs, and interfaces: **"Table"** over "Collection", and **"Row"** over "Document".

---

## 🧪 Verification & Stability Audit

- [ ] **Locally Verify Operations**: Run standard development cycles to prove that the application behavior is identical.
- [ ] **Audit Session Discovery**: Validate that Actor validation functions correctly across different client platforms.
- [ ] **Perform End-to-End Test Runs**: Verify user sign-in, note list rendering, file attachment management, and secure vaults.
