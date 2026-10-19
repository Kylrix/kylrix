# Kylrix VS Code Extension

Official VS Code Extension for **Kylrix** — Sovereign AI Vault, Notes, 2FA Authenticator, and Cross-Tool Context Assistant.

## Features

- **Rich Activity Bar Sidebar**:
  - **Identity & Session**: Real-time account status, active workspace indicator, vault security state, and one-click cloud sync.
  - **Notes & Ideas**: Sovereign local-first markdown note taking, article previews, categories, and instant cloud sync.
  - **Goals & Progress**: Goal tracking with visual progress bars (`[████░░░░] 50%`) and status badges.
  - **Vault & Secrets**: Encrypted credentials, `.env` file injection (`Pull .env` / `Push .env`), and vault locking.
  - **2FA Authenticator**: Sovereign 2FA TOTP code generator with instant clipboard copy.
  - **Events, Forms & Flows**: Integrated calendar events, interactive form definitions, and workflow automations.
  - **Chats & Threads**: Real-time hangout conversations and discussion comment threads.
  - **Agents & Context**: AI execution session logs and cross-tool directory context synthesis.
  - **Trash & Tags**: Sovereign tag management and soft-deleted items recovery/purge.

- **Full Command Palette Integration**:
  - Access all Kylrix commands directly via `Ctrl+Shift+P` / `Cmd+Shift+P` -> `Kylrix: ...`.
- **Modern sign-in options**:
  - Use **Login with API Key** for the same PAT/agent-key flow as `@kylrix/cli`.
  - Use **Login with Browser** for browser approval and device pairing; the returned session is saved to the shared CLI config.

- **Shared Backend & Sovereign Storage**:
  - Automatically reuses local SQLite database (`~/.kylrix/silos/...`), account sessions, and encryption state shared with `@kylrix/cli`.
  - Works 100% standalone whether the CLI binary is installed or not.

The extension bundle is emitted as CommonJS (`dist/extension.cjs`) even though the package uses
ES modules elsewhere. This is required by the VS Code extension host and avoids loading the
CommonJS bundle as an ES module.
