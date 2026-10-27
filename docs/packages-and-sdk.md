# Packages, CLI & TypeScript SDK Architecture

This document details the monorepo packages (`@kylrix/cli` and `packages/vscode`) and the TypeScript SDK (`@kylrix/sdk`).

---

## 📦 Monorepo Package Topology

```
packages/
├── cli/                 # @kylrix/cli (Terminal CLI & MCP Stdio Bridge)
│   ├── src/             # Commands: exec, stdio, login, status, envs
│   ├── package.json     # CLI package metadata
│   └── tsup.config.ts   # Bundler config producing standalone binary
└── vscode/              # VS Code Extension (packages/vscode)
    ├── src/             # Extension entrypoints & sidebars
    ├── package.json     # Extension manifest
    └── tsup.config.ts   # CJS standalone extension bundler

sdk/                     # @kylrix/sdk (Typed Client Library)
├── api/                 # Low-level REST API client & routes
├── contracts/           # Strongly-typed schemas (notes, goals, vault, agents, etc.)
└── index.ts             # Primary SDK entrypoint
```

---

## 💻 `@kylrix/cli` Architecture

The CLI package (`packages/cli`) provides local terminal workspace operations and serves as an stdio MCP bridge for AI IDEs like Cursor and Claude Code.

### Key Features & Storage Layout
- **Shared Local Directory (`~/.kylrix`):** Stores local SQLite cache (`~/.kylrix/local.sqlite`), agent identities (`~/.kylrix/agents/`), and local configuration (`~/.kylrix/config.json`).
- **Commands:**
  - `kylrix login`: Interactive pairing and PAT token authentication.
  - `kylrix status`: Inspect active account, workspace, and connection state.
  - `kylrix stdio`: Connect AI IDEs via stdio Model Context Protocol (MCP).
  - `kylrix exec <idOrUrl> [command...]`: Execute child processes with zero-leak transient environment variable injection.

### Version Bumping Protocol
When releasing a new version of `@kylrix/cli`, you **must** update both:
1. `version` in `packages/cli/package.json`
2. `CURRENT_VERSION` in `packages/cli/src/updater/index.ts`

---

## 🧩 VS Code Extension (`packages/vscode`)

The official VS Code extension resides in `packages/vscode` (`kylrix-vscode`).

- **Shared Engine:** Shares the local storage directory (`~/.kylrix`), SQLite local store, configuration silos, and API client directly with `@kylrix/cli`.
- **Bundling:** Built using `tsup` (`pnpm run build:vscode`) into a standalone CommonJS (`CJS`) bundle ready for VS Code Extension Marketplace packaging.

---

## 🛠️ TypeScript SDK (`@kylrix/sdk`)

The SDK provides programmatic TypeScript bindings for embedding Kylrix capabilities into third-party Node.js, Web, and Edge applications.

### Usage Example

```typescript
import { KylrixClient } from '@kylrix/sdk';

const client = new KylrixClient({
  apiBase: 'https://www.kylrix.space/api/v1',
  token: 'kyl_pat_...'
});

// Fetch user profile
const me = await client.users.getMe();
console.log(`Authenticated as ${me.email}`);

// Create a note
const note = await client.notes.create({
  title: 'SDK Quickstart',
  body: 'Created programmatically via @kylrix/sdk',
  tags: ['sdk', 'automation']
});
```

### Typed Contracts (`sdk/contracts/`)
The SDK exports TypeScript interfaces for all domain entities:
- `notes`: `NoteContract`, `CreateNotePayload`
- `goals`: `GoalContract`, `UpdateGoalPayload`
- `vault`: `CredentialContract`, `TotpContract`
- `workspaces`: `WorkspaceContract`
- `agents`: `AgentIdentityContract`, `ProvisionAgentPayload`
- `pairing`: `PairingCodeContract`
