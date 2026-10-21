# 🧩 Functional Modularity Roadmap

## Architectural Vision & Core Axiom

The foundational axiom of the Kylrix platform is total separation of client presentation/transport layers from domain functionalities. **No client surface—whether UI, REST API (`/api/v1`), Model Context Protocol (MCP), CLI terminal, or Discord/Telegram bots—shall ever hardcode or re-implement business logic.**

### The Universal Invariant: Everything is a Tool Call

```
[ UI Components ] \
[ REST API /v1 ]   \
[ MCP Handlers ]   ----> [ Tool Call Dispatcher ] ----> [ Fundamental Building Blocks ]
[ CLI Terminal ]   /     (Schema Validation,         (CRUD, Search, Sync, Vault,
[ Chat Bots    ]  /       Auth, Rate Limit, Audit)    Execution, Storage, Auth)
```

Every operational action in the application MUST be modeled as a typed, invocation-agnostic **Tool Call**. Tool calls act as the sole conduit through which clients interact with domain primitives. Every tool call hooks into a composable set of **Fundamental Building Blocks**:

1. **CRUD Core**: Pure entity mutation and relational graph manipulation over local/remote engines (`lib/db`).
2. **Search & Indexing Engine**: Unified semantic and exact-match indexing across notes, goals, workspaces, and vaults.
3. **Autonomic Sync Engine**: Asynchronous state propagation, diffing, dirty-checking, and transactional reconciliation (`lib/services/sync-engine.ts`).
4. **Cryptographic Vault & Key Enclave**: Zero-knowledge payload encryption, MasterPass unwrapping, and secret rotation (`lib/vault`).
5. **Messaging & Threading**: Unified event streaming, WebSocket broadcasting (`lib/realtime/partykit.ts`), and agentic conversation channels.
6. **Execution & Agentic Harness**: Ephemeral environment execution, tool invocation sandboxing, and context synthesis.

---

## Roadmap Items: Comprehensive Breakdown & Execution Phases

---

### Item 1: Universal Tool Call Abstraction & Dispatch Engine

#### Problem & Current State
Currently, domain operations are duplicated across multiple access routes:
- Server Actions (`lib/actions/turso-ops.ts`, `lib/actions/secure-ops/`) perform DB operations and check authorization.
- REST API v1 handlers (`lib/api/resources.ts`, `app/api/v1/`) parse JSON payloads and re-verify session actors.
- MCP handlers (`lib/mcp/dispatch.ts`) manually adapt arguments and map responses using `mcpListResult`.
- UI contexts (`context/NotesContext.tsx`, `context/TaskContext.tsx`) execute local state mutations alongside manual sync invocations.

This multi-path approach duplicates payload validation, capability checks, error formatting, and audit logging.

#### Architectural Specification
Construct a unified `ToolDispatcher` registry where every tool defines:
- **`id`**: Unique tool identifier (e.g., `note.create`, `vault.item.get`, `workspace.collaborator.add`).
- **`inputSchema`**: Strict Zod schema for input validation and type safety.
- **`outputSchema`**: Zod schema for output normalization.
- **`capabilities`**: Required entitlement features or permissions (e.g., `paid_tier`, `workspace.write`).
- **`handler`**: Pure async execution logic receiving `(context: InvocationContext, args: TInput)` and returning `Promise<TOutput>`.

```typescript
export interface InvocationContext {
  actor: ApiActor;
  transport: 'mcp' | 'rest' | 'ui' | 'cli' | 'bot';
  traceId: string;
  skipPendingSync?: boolean;
}

export interface SystemTool<TInput = any, TOutput = any> {
  id: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  featureId?: FeatureId;
  execute: (ctx: InvocationContext, input: TInput) => Promise<TOutput>;
}
```

#### Actionable Execution Phases
- [ ] **Phase 1.1**: Define the universal `SystemTool` interface and registry in `lib/tools/registry.ts`.
- [ ] **Phase 1.2**: Implement input/output Zod validation middleware that executes uniformly across all transport adapters.
- [ ] **Phase 1.3**: Migrating existing `ApiResources` functions in `lib/api/resources.ts` to register as declarative `SystemTool` instances.
- [ ] **Phase 1.4**: Standardize error envelope signatures (handling `PaymentRequiredError`, `NotFoundError`, `UnauthorizedError`) across all tools.

---

### Item 2: Primitive Layer Consolidation (CRUD, Search, Sync, Vault, Execution)

#### Problem & Current State
The primitives themselves currently hold transport-aware logic or dual-path fallbacks:
- `secure-ops/projects.ts` contains fallback logic between Turso SQLite queries and legacy Appwrite calls.
- `lib/services/sync-engine.ts` handles payload prefix parsing (`cred:`, `totp:`, `note:`) with entity-specific flush handlers (`flushNotePending`, `flushGoalPending`).
- Local-first hydration in UI hooks independently implements cache check fallbacks (`f_notes_list`, `f_notes_list_guest`).

#### Architectural Specification
Extract and streamline building blocks into fundamental, reusable engine primitives:

1. **Generic CRUD Primitive (`lib/db/repository.ts`)**:
   - Universal entity repository interface abstracting SQLite table definitions, soft deletes (`deletedAt`), and workspace scoping.
2. **Unified Sync Primitive (`lib/services/sync-engine.ts`)**:
   - Generic queue flusher operating on registered entity adapters rather than monolithic `switch` blocks.
3. **Unified Vault Primitive (`lib/vault/`)**:
   - Single-pass decryption pipeline consolidating MasterPass key unwrapping, DEK AES-GCM, and MEK fallback logic.

#### Actionable Execution Phases
- [ ] **Phase 2.1**: Refactor entity sync flushes in `autonomicSyncEngine` to use an entity-adapter map (`Map<string, SyncAdapter>`), eliminating hardcoded `if/else` checks for `cred:`, `totp:`, `note:`, `goal:`.
- [ ] **Phase 2.2**: Unify database query generation across all entities using `lib/db/queries.ts` and `TursoDatabaseAdapter`.
- [ ] **Phase 2.3**: Eliminate dual-path Appwrite fallbacks from primary CRUD operations, routing 100% of entity operations through canonical Turso/Drizzle definitions.

---

### Item 3: Client Interface Decoupling & Thin Transport Adapters

#### Problem & Current State
Clients currently contain transport-specific transformation logic:
- REST controllers in `app/api/v1/` duplicate query parameter parsing and status code mapping.
- MCP SSE/HTTP controllers in `lib/mcp/handler.ts` handle tool listing and invocation using custom formatting.
- Telegram/Discord bots in `app/api/telegram/webhook/` and `app/api/discord/` re-implement user actor resolution and resource lookup logic.

#### Architectural Specification
All clients MUST become zero-logic, thin adapters:

```
                  +-------------------------+
                  |    Client Transports    |
                  +-------------------------+
                  | REST API | MCP | UI | Bot |
                  +------------+------------+
                               |
                               v (Transform request to ToolCall)
                  +-------------------------+
                  |     Tool Dispatcher     |
                  +-------------------------+
                               |
                               v (Execute)
                  +-------------------------+
                  |  Domain Building Blocks |
                  +-------------------------+
```

1. **REST Adapter (`app/api/v1/ route handlers`)**: Reads HTTP request -> maps route to `toolId` -> invokes `ToolDispatcher.execute()` -> returns standard JSON response.
2. **MCP Adapter (`lib/mcp/`)**: Generates MCP protocol JSON schema dynamically from `SystemTool.inputSchema` -> executes tool -> wraps response using `mcpListResult` or `mcpObjectResult`.
3. **UI Hooks (`hooks/useToolCall.ts`)**: React hook binding UI actions directly to tool execution, automatically updating local optimistic cache and triggering background sync sweeps.
4. **Messaging Adapter (`lib/telegram/`, `lib/discord/`)**: Parses incoming chat commands -> maps command to `toolId` -> dispatches tool -> returns formatted Markdown reply.

#### Actionable Execution Phases
- [ ] **Phase 3.1**: Create `lib/tools/adapters/mcp.ts` to automatically derive MCP tool definitions from `SystemTool` registry schemas.
- [ ] **Phase 3.2**: Create `lib/tools/adapters/rest.ts` providing standard Next.js route handler adapters.
- [ ] **Phase 3.3**: Refactor Discord and Telegram webhooks to invoke tools via `ToolDispatcher` rather than calling `ApiResources` or direct database helpers.
- [ ] **Phase 3.4**: Introduce `useToolMutation` React hook in UI components to standardize optimistic updates, error handling, and dirty-state sync queuing.

---

### Item 4: Universal Middleware & Interception Pipelines

#### Problem & Current State
Cross-cutting concerns (authentication validation, rate limiting, feature access gating, real-time WebSocket event broadcasting, and audit logging) are implemented inconsistently:
- Feature entitlement gating (`assertPaidActor`) is checked inside specific `ApiResources` methods.
- Real-time event broadcasting (`broadcastRealtimeEvent`) is invoked manually in some server actions (`secure-ops/misc.ts`) but missing in others.
- Audit logging is called explicitly in select HTTP handlers.

#### Architectural Specification
Implement an pipeline execution model for all tool calls:

```
[ Incoming Tool Call ]
         |
         v
  [ Middleware 1: Auth & Actor Resolution ]
         |
         v
  [ Middleware 2: Entitlement & Feature Gating ]
         |
         v
  [ Middleware 3: Rate Limiting & Audit Logging ]
         |
         v
  [ Core Tool Handler Execution ]
         |
         v
  [ Middleware 4: Real-Time Event Broadcasting (PartyKit) ]
         |
         v
  [ Middleware 5: Response Normalization & Sanitization ]
         |
         v
[ Client Result ]
```

#### Actionable Execution Phases
- [ ] **Phase 4.1**: Implement generic middleware pipeline (`ToolMiddleware`) in `lib/tools/pipeline.ts`.
- [ ] **Phase 4.2**: Wrap entitlement verification (`assertActorFeatureAccess` / `assertPaidActor`) into standard pre-execution middleware.
- [ ] **Phase 4.3**: Implement automatic post-execution broadcasting middleware that inspects entity mutations (`create`, `update`, `delete`) and triggers `broadcastRealtimeEvent` automatically.
- [ ] **Phase 4.4**: Implement secret sanitization middleware using `lib/logger.ts` redact utilities to ensure sensitive payload data (tokens, passwords) is never leaked in log traces or tool outputs.

---

### Item 5: Extensible Agent Mesh & Dynamic Tool Execution

#### Problem & Current State
Human users and AI agent harnesses (Cursor, Claude Code, internal agents) run through disparate pathways. Agent sessions use separate harness functions (`createHarnessSession`), while UI components use context providers.

#### Architectural Specification
Unify agent execution with human execution:
- AI agents and human users interact with the exact same tool registry.
- Agent permissions are scoped using Cryptographic Object Capabilities (O-Caps) mapped directly to tool invocation middleware.
- Dynamic tool registration allows plugins or runtime extension packages (`packages/`) to inject new tools into the registry at startup.

#### Actionable Execution Phases
- [ ] **Phase 5.1**: Build capability-checking middleware validating token scopes / O-Cap grants against `SystemTool.id`.
- [ ] **Phase 5.2**: Provide runtime tool discovery endpoint for AI agents (`/api/v1/tools/catalog`).
- [ ] **Phase 5.3**: Ensure CLI (`@kylrix/cli`), VS Code extension (`packages/vscode`), and Web MCP runtimes call identical tool dispatchers.

---

## 📉 Summary of Expected Architectural Gains

1. **Zero Logic Duplication**: Business rules exist in exactly one location per domain primitive.
2. **Instant Transport Parity**: Adding a new feature automatically exposes it to UI, REST API, MCP, CLI, and Bots simultaneously without transport-specific code.
3. **Decoupled Testability**: 100% of domain logic can be tested via pure unit tests on `SystemTool` implementations without mocking HTTP servers or React contexts.
4. **Bloat Reduction**: Eliminates hundreds of redundant wrapper functions, leading directly to the codebase slimming targets set in [`LOC.md`](./LOC.md).
