# `@kylrix/cli` (CLI & Isomorphic SDK)

Official Command-Line Interface (CLI), embedded SQLite local-first engine, Model Context Protocol (MCP) Bridge, and Isomorphic SDK for **Kylrix** sovereign agentic workspaces.

---

## ⚡ Quick Start

### 1-Click Web Login
Authenticate instantly without copying or pasting tokens (or run offline without an account):
```bash
npx @kylrix/cli login
```
The CLI displays your instant code, automatically opens `https://www.kylrix.space/login/KYL-XXXX` in your browser, and logs in immediately when approved.

### Run with `npx`
```bash
# Manage Workspaces
npx kylrix workspaces list
npx kylrix workspaces switch <workspace-id>

# Manage Sovereign Ideas & Articles
npx kylrix ideas list
npx kylrix ideas create "Q4 System Architecture" --content "New modular flow..."
npx kylrix ideas articles

# Manage Goals & Habits
npx kylrix goals list
npx kylrix goals update <goal-id> --progress 75

# Bitwarden-Style Encrypted Vault & Project .env
npx kylrix vault unlock
npx kylrix vault list --decrypt
npx kylrix vault get <secret-id> --format env --pure > .env
npx kylrix vault lock

# Sovereign 2FA TOTP Authenticator
npx kylrix totp list
npx kylrix totp code <account-id>

# Global Search
npx kylrix search "database migration"

# Model Context Protocol (MCP) Stdio Server for Cursor / Claude Code / Windsurf
npx kylrix mcp
```

### Install globally
```bash
npm install -g kylrix
# or
pnpm add -g kylrix
```

---

## 🔐 Bitwarden-Style Vault Security Model

Kylrix CLI implements client-side Master Encryption Key (MEK) derivation and transient session caching:

1. **`kylrix vault unlock`**: Prompts for your Master Password (or accepts `--password`), derives/unwraps your MEK, and initiates a temporary session (default 60 mins).
2. **Seamless Decryption**: Commands like `kylrix vault list --decrypt`, `kylrix vault get <id>`, and `kylrix totp code <id>` use the active session key automatically.
3. **`kylrix vault lock`**: Immediately wipes all in-memory keys and session tokens.
4. **`kylrix vault status`**: Shows whether the vault is locked/unlocked and remaining minutes.

---

## 🤖 Model Context Protocol (MCP) Integration

Plug your sovereign Kylrix workspace into Cursor, Windsurf, Claude Code, or Antigravity via stdio:

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "kylrix": {
      "command": "npx",
      "args": ["-y", "kylrix", "mcp"],
      "env": {
        "KYLRIX_API_KEY": "pat_..."
      }
    }
  }
}
```

---

## 📋 Complete CLI Commands Reference

| Category | Commands | Description |
|---|---|---|
| **Auth** | `login`, `pair`, `whoami`, `logout` | 1-Click web pairing, token check, logout |
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
| **Hangouts** | `hangouts list`, `messages`, `send` | Direct discussions, group hangouts, and messaging |
| **Billing** | `billing status`, `coins`, `checkout`, `coupon` | Pro upgrades, on-chain crypto checkout, promo coupons |
| **Admin** | `admin` | Server status and admin privilege verification |
| **Trash** | `trash list`, `restore`, `purge` | Soft-deleted item inspection, recovery, and purge |

---

## 💻 Isomorphic SDK Usage

```typescript
import { createKylrixClient } from 'kylrix';

const client = createKylrixClient({
  baseUrl: 'https://www.kylrix.space',
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
