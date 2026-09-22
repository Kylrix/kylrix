# Kylrix CLI (`@kylrix/cli`)

The official command-line interface, local-first SQLite engine, Model Context Protocol (MCP) bridge, and isomorphic TypeScript SDK for **Kylrix**.

---

## ⚡ 30-Second Quickstart

### 1. Install Globally (Offline Local-First)
```bash
npm install -g @kylrix/cli
# or: pnpm add -g @kylrix/cli
```

### 2. Run Directly from Terminal
```bash
# 1-Click Web Authorization (or use offline without an account)
kylrix login

# Start using ideas & goals
kylrix ideas create "Launch Kylrix v1"
kylrix ideas list

# Start stdio MCP Server for AI coding agents (Cursor / Claude / Windsurf)
kylrix mcp
```

*(Zero-install alternative: run with `npx @kylrix/cli <command>`)*

---

## 🛡️ Architecture & Key Features

### 1. True Local-First (Powered by Embedded SQLite)
* **Zero Login Required**: You can start managing ideas, goals, encrypted secrets, TOTP codes, and calendar events immediately offline without creating an account.
* **Embedded SQLite**: All local state is persisted in an embedded SQLite database located at `~/.kylrix/local.db`.
* **Sync When Ready**: Once you authenticate (`kylrix login`), running **`kylrix sync`** pushes your local SQLite records up to your Kylrix Cloud workspace.

### 2. 1-Click Web Login & Pairing
* Running `kylrix login` initiates RFC 8628 pairing and opens `https://www.kylrix.space/login/KYL-XXXX` in your browser.
* Clicking **"Authorize"** in the web workspace logs your CLI session in instantly with zero manual token copying.

### 3. Bitwarden-Style Encrypted Vault & 2FA TOTP
* **`kylrix vault unlock`**: Prompts for your Master Password (or accepts `--password`), derives your Master Encryption Key (MEK), and holds a transient session.
* **`kylrix vault list --decrypt` / `get <id> --pure > .env`**: Seamlessly decrypts secrets and exports project environment variables.
* **`kylrix vault lock`**: Immediately wipes keys from memory.
* **`kylrix totp list` / `code <id>`**: Generates real-time 6-digit TOTP verification codes with countdowns.

### 4. Model Context Protocol (MCP) Stdio Server
Bridge your sovereign Kylrix workspace into Cursor, Windsurf, or Claude Code:
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

---

## 📋 Command Catalog

### Authentication & Account
| Command | Description |
|---|---|
| `kylrix login` | 1-Click web login & browser pairing |
| `kylrix pair` | Authenticate with RFC 8628 code |
| `kylrix whoami` (alias `me`) | Display active identity, email, scopes, and tier |
| `kylrix logout` | Remove stored local authentication tokens |
| `kylrix settings` | View account configuration and limits |
| `kylrix admin` | Verify admin status and Edge Shield health |

### Workspace Management
| Command | Description |
|---|---|
| `kylrix workspaces list` | List all accessible workspaces |
| `kylrix workspaces get <id>` | View workspace details |
| `kylrix workspaces create <name>` | Create a new workspace |
| `kylrix workspaces switch <id>` (alias `use`) | Set active default workspace for all commands |
| `kylrix workspaces current` | Print currently active workspace |
| `kylrix workspaces clear` | Reset back to Personal Virtual Workspace |
| `kylrix workspaces delete <id>` | Delete a workspace |

### Ideas & Articles
| Command | Description |
|---|---|
| `kylrix ideas list` | List sovereign ideas and notes |
| `kylrix ideas get <id>` | View idea content |
| `kylrix ideas create <title>` | Create a new idea (`--content`, `--category`, `--tags`) |
| `kylrix ideas update <id>` | Update idea title or content |
| `kylrix ideas delete <id>` | Soft-delete an idea to trash |
| `kylrix ideas articles` | Filter long-form published articles |

### Goals & Milestones
| Command | Description |
|---|---|
| `kylrix goals list` | List goals and progress (`--status`) |
| `kylrix goals get <id>` | Inspect goal milestones and target |
| `kylrix goals create <title>` | Create a goal (`--target`, `--unit`) |
| `kylrix goals update <id>` | Update progress (`--progress 75`) or status |
| `kylrix goals delete <id>` | Delete a goal |

### Encrypted Vault & Secrets
| Command | Description |
|---|---|
| `kylrix vault unlock` | Unlock Master Encryption Key (MEK) |
| `kylrix vault lock` | Seal vault and wipe keys from memory |
| `kylrix vault status` | Check if vault is locked or unlocked |
| `kylrix vault list` | List credentials (`--decrypt` to unseal) |
| `kylrix vault get <id>` | View secret (`--format env --pure` for dotenv) |
| `kylrix vault create <name>` | Add secret or import `--env-file .env` |
| `kylrix vault delete <id>` | Delete a secret |

### 2FA TOTP Authenticator
| Command | Description |
|---|---|
| `kylrix totp list` | List accounts with live 6-digit codes |
| `kylrix totp code <id>` | Output raw 6-digit code for pipes/clipboard |
| `kylrix totp create <name>` | Add TOTP secret key (`--secret <base32>`) |
| `kylrix totp delete <id>` | Remove TOTP seed |

### AI Agents & Search
| Command | Description |
|---|---|
| `kylrix agents list` | List autonomous agent execution sessions |
| `kylrix agents get <id>` | View agent execution logs and transcript |
| `kylrix agents start <title>` | Launch autonomous agent session (`--prompt`) |
| `kylrix search <query>` | Global search across ideas, goals, events, secrets |
| `kylrix share <kind> <id>` | Generate shareable link |

### Calendar, Forms, Flows & Hangouts
| Command | Description |
|---|---|
| `kylrix events list/create/delete` | Calendar events and schedules |
| `kylrix forms list/get/create/delete` | Interactive forms |
| `kylrix flows list/get/create/delete` | Workflow automation pipelines |
| `kylrix hangouts list/messages/send` | Real-time discussions and messages |
| `kylrix threads list/messages/send` | Discussion threads on workspace objects |
| `kylrix tags list/create/delete` | Sovereign tagging system |
| `kylrix trash list/restore/purge` | Soft-deleted item recovery |

### Sync & Self-Update
| Command | Description |
|---|---|
| `kylrix sync` | Synchronize local SQLite records to Kylrix Cloud |
| `kylrix update` (alias `upgrade`) | Auto-upgrade CLI to latest published version |

---

## 💻 Programmatic SDK Usage

```typescript
import { createKylrixClient } from '@kylrix/cli';

const client = createKylrixClient({
  baseUrl: 'https://www.kylrix.space',
  token: 'pat_...',
});

// Search across workspace
const results = await client.search.query('architecture');

// Create goal
const goal = await client.goals.create({
  title: 'Ship v1.0.0 CLI',
  targetValue: 100,
  unit: '%',
});
```

---

## 📜 License

AGPL-3.0-or-later © Kylrix
