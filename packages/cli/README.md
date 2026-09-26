# `@kylrix/cli`

<p align="center">
  <strong>The official command-line interface, embedded SQLite local-first engine, Model Context Protocol (MCP) bridge, and isomorphic SDK for Kylrix sovereign agentic workspaces.</strong>
</p>

<p align="center">
  Open Source · Self-Hostable · Local-First · Optional Encryption · Multi-Account Silos
</p>

<p align="center">
  <a href="https://www.kylrix.space">kylrix.space</a> ·
  <a href="https://www.kylrix.space/docs/api">API Docs</a> ·
  <a href="https://github.com/Kylrix/kylrix">GitHub</a>
</p>

---

## ⚡ 30-Second Quickstart

### 1. Install Globally (Offline Local-First)

```bash
npm install -g @kylrix/cli
```

*(or via pnpm)*
```bash
pnpm add -g @kylrix/cli
```

*(Zero-install alternative: run directly with `npx @kylrix/cli <command>`)*

---

### 2. 1-Click Web Login (Cloud or Custom Base URI)

Authenticate instantly without copying or pasting tokens:

```bash
# Connect to Kylrix Cloud (default)
kylrix login

# Connect to self-hosted instance or custom backend base URI
kylrix login --url http://localhost:3005
```

The CLI displays your instant code, automatically opens the authorization page on the target server (e.g. `https://www.kylrix.space/login/KYL-XXXX` or `http://localhost:3005/login/KYL-XXXX`), and logs in immediately when approved in the browser.

---

### 3. Multi-Account Profiles & Base URI Silos

Manage multiple accounts across cloud and self-hosted instances with zero data bleed:

```bash
# List accounts partitioned under the active base URI
kylrix accounts list

# Switch active account profile seamlessly
kylrix accounts switch user@example.com

# Show currently active account profile and local silo path
kylrix accounts current

# Manage server base URIs and partitions
kylrix server list
kylrix server switch http://localhost:3005
```

---

### 4. Essential Commands

#### Sovereign Ideas & Notes
```bash
# List ideas
kylrix ideas list

# Create a new idea
kylrix ideas create "Q4 System Architecture" --content "Modular agentic flow..."

# View published articles
kylrix ideas articles
```

#### Goals & Habit Milestones
```bash
# List goals
kylrix goals list

# Update goal progress
kylrix goals update <goal-id> --progress 75
```

#### Encrypted Vault & Project `.env` (Bitwarden-Style)
```bash
# Unlock vault Master Encryption Key (MEK) for 60 mins
kylrix vault unlock

# List decrypted credentials
kylrix vault list --decrypt

# Export secret directly to project .env file
kylrix vault get <secret-id> --format env --pure > .env

# Seal vault and wipe keys from memory
kylrix vault lock
```

#### Sovereign 2FA TOTP Authenticator
```bash
# List TOTP accounts with live codes and countdown timers
kylrix totp list

# Generate current 6-digit TOTP code for scripts/pipes
kylrix totp code <account-id> --pure
```

#### Autonomous AI Agents & Execution Sessions
```bash
# List agent sessions
kylrix agents list

# Launch an autonomous agent session
kylrix agents start "Audit database migrations and schema"
```

#### Model Context Protocol (MCP) Stdio Server
Start the MCP server to bridge your workspace into Cursor, Windsurf, Claude Code, or Antigravity:
```bash
kylrix mcp
```

---

## 🛡️ Architecture & Partitioned Silos

### 1. True Local-First with Embedded SQLite
* **Zero Login Required**: You can start creating ideas, goals, encrypted secrets, TOTP codes, and calendar events immediately offline without creating an account.
* **Base URI Partitioning**: All state is strictly partitioned first by backend base URI. Kylrix Cloud is isolated under the `default` partition (`~/.kylrix/silos/default/`), while self-hosted instances (`http://localhost:3005`) are partitioned into their own directory trees (`~/.kylrix/silos/<partitionKey>/`).
* **Account-Level Silos**: Within each base URI partition, accounts are isolated into separate silos (`~/.kylrix/silos/<partitionKey>/<userId>/`). Switching accounts (`kylrix accounts switch <email>`) immediately routes local storage to that user's silo without data bleed.
* **Offline Anonymous Silo**: Unauthenticated work is safely preserved in `~/.kylrix/silos/default/anonymous/local.db`.
* **Sync When Ready**: Once you authenticate (`kylrix login`), running **`kylrix sync`** pushes local SQLite records to your cloud or self-hosted workspace.

### 2. Bitwarden-Style Vault Security Model
1. **`kylrix vault unlock`**: Prompts for your Master Password (or accepts `--password`), derives/unwraps your Master Encryption Key (MEK), and initiates a temporary session (default 60 mins).
2. **Seamless Decryption**: Commands like `kylrix vault list --decrypt`, `kylrix vault get <id>`, and `kylrix totp code <id>` use the active session key automatically.
3. **`kylrix vault lock`**: Immediately wipes all in-memory keys and session tokens.
4. **`kylrix vault status`**: Shows whether the vault is locked/unlocked and remaining session minutes.

---

## 🤖 Model Context Protocol (MCP) Integration

Plug your sovereign Kylrix workspace into Cursor, Windsurf, Claude Code, or Antigravity via stdio:

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "kylrix": {
      "command": "npx",
      "args": ["-y", "@kylrix/cli", "mcp"],
      "env": {
        "KYLRIX_API_KEY": "pat_..."
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "kylrix": {
      "command": "npx",
      "args": ["-y", "@kylrix/cli", "mcp"]
    }
  }
}
```

---

## 📋 Complete CLI Commands Reference

| Category | Commands | Description |
|---|---|---|
| **Auth** | `login`, `pair`, `whoami`, `logout` | 1-Click web pairing (`--url <url>`), token check, logout |
| **Accounts** | `accounts list`, `switch`, `current`, `remove` | Multi-account profiles and switching under base URI silos |
| **Servers** | `server list`, `switch`, `current`, `add`, `remove` | Backend base URIs, partitions, and self-hosted instances |
| **Workspaces** | `workspaces list`, `get`, `create`, `delete`, `switch`, `current`, `clear` | Multi-workspace management & active scope switching |
| **Ideas & Articles** | `ideas list`, `get`, `create`, `update`, `delete`, `articles` | Sovereign notes, brainstorms, and long-form articles |
| **Goals** | `goals list`, `get`, `create`, `update`, `delete` | Objective and habit milestone tracking |
| **Vault & Secrets** | `vault unlock`, `lock`, `status`, `list`, `get`, `create`, `delete` | End-to-end encrypted credentials and project `.env` files |
| **2FA TOTP** | `totp list`, `code`, `create`, `delete` | Real-time 6-digit TOTP verification code generation |
| **AI Agents** | `agents list`, `get`, `start`, `delete` | Autonomous agent execution sessions and logs |
| **Search** | `search <query>` | Global search across ideas, goals, events, forms, flows, secrets |
| **Share** | `share <kind> <id>` | Generate shareable link respecting account subscription tier |
| **Calendar** | `events list`, `create`, `delete` | Calendar events and scheduled tasks |
| **Forms & Flows** | `forms list/get/create`, `flows list/get/create` | Interactive forms and automated workflow pipelines |
| **Discussions** | `hangouts list/messages/send`, `threads list/messages/send` | Real-time chats, threads, and unified commenting |
| **Billing** | `billing status`, `coins`, `checkout`, `coupon` | Pro upgrades, on-chain crypto checkout, promo coupons |
| **Admin** | `admin` | Server status and admin privilege verification |
| **Trash** | `trash list`, `restore`, `purge` | Soft-deleted item inspection, recovery, and purge |
| **Sync** | `sync` | Push sovereign local-first records to active workspace |
| **Update** | `update` (alias `upgrade`) | Automatically self-update CLI to the latest version |
| **MCP** | `mcp` | Start Model Context Protocol stdio server bridge |

---

## 💻 Isomorphic SDK Usage

```typescript
import { createKylrixClient } from 'kylrix';

const client = createKylrixClient({
  baseUrl: 'https://www.kylrix.space', // or custom self-hosted base URI
  token: 'pat_...',
});

// Search across workspace
const results = await client.search.query('infrastructure');

// Create goal
const goal = await client.goals.create({
  title: 'Achieve 100% test coverage',
  targetValue: 100,
});
```

---

## 📜 License

AGPL-3.0-or-later © Kylrix
