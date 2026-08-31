---
name: mcp
description: >-
  Connect AI tools, Claude Code, Cursor, and autonomous agents to Kylrix via the
  Model Context Protocol (MCP) server. Provides stateless JSON-RPC over Streamable HTTP
  with full 1:1 parity for workspaces, notes, goals, calendar, forms, flows, chats, moments, and agent sessions.
---

# Kylrix Model Context Protocol (MCP)

**Start here:** [docs/integrations.md](../docs/integrations.md)

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

## Endpoint

**Production:** `https://www.kylrix.space/api/v1/mcp`

Self-hosted? See [SELFHOST.md](../SELFHOST.md).

## Quick Start

### Smithery (recommended)

Mint a PAT at [Settings → Developers](https://www.kylrix.space/settings?tab=developers) (`kyl_pat_…`), then:

```bash
npx -y @smithery/cli install kylrix/kylrix --client cursor
npx -y @smithery/cli install kylrix/kylrix --client claude
npx -y @smithery/cli install kylrix/kylrix --client windsurf
npx -y @smithery/cli install kylrix/kylrix --client codex
npx -y @smithery/cli install kylrix/kylrix --client antigravity
```

Smithery wires the official endpoint. Add your PAT when prompted.

### Claude Code (manual)
```bash
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"
```

### Cursor / Claude Desktop (manual)
Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `.cursor/mcp.json` (do **not** commit tokens).

```json
{
  "mcpServers": {
    "kylrix": {
      "type": "http",
      "url": "https://www.kylrix.space/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_PAT_TOKEN>"
      }
    }
  }
}
```

Mint PAT: **Settings → Developers** on [kylrix.space](https://www.kylrix.space). Reload IDE after saving.

## Available MCP Tools

| Category | Tools |
|---|---|
| **Identity & Scopes** | `get_my_profile`, `get_token_info`, `list_available_scopes`, `refresh_token_scopes` |
| **Workspaces** | `list_workspaces`, `get_workspace`, `create_workspace`, `update_workspace`, `delete_workspace`, `list_workspace_collaborators`, `add_workspace_collaborator` |
| **Notes & Ideas** | `list_notes`, `get_note`, `create_note`, `update_note`, `delete_note` |
| **Goals & Tasks** | `list_goals`, `get_goal`, `create_goal`, `update_goal`, `delete_goal` |
| **Calendar & Events** | `list_events`, `get_event`, `create_event`, `update_event`, `delete_event` |
| **Forms** | `list_forms`, `get_form`, `create_form`, `delete_form` |
| **Chats** | `list_chats`, `get_chat`, `list_chat_messages`, `send_chat_message` |
| **Flows** | `list_flows`, `get_flow`, `create_flow`, `delete_flow` |
| **Tags** | `list_tags`, `create_tag`, `delete_tag` |
| **Moments** | `list_moments`, `get_moment`, `create_moment`, `list_moment_comments`, `create_moment_comment` |
| **Threads** | `list_thread_messages`, `create_thread_message` |
| **Agent Sessions** | `list_agent_sessions`, `get_agent_session`, `create_agent_session` |
| **Trash** | `list_trash`, `restore_trash`, `purge_trash` |

## Architecture

- **Streamable HTTP & SSE**: Next.js (`/api/v1/mcp`).
- **Unified with REST**: MCP → `ApiResources` (same as `/api/v1/*`).
- **Auth**: `kyl_pat_…` PATs and OAuth 2.1 tokens.

Full docs: [docs/mcp.md](../docs/mcp.md)
