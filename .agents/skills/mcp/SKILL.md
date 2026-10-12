---
name: mcp
description: Model Context Protocol (MCP) server for Kylrix. Stateless JSON-RPC over Streamable HTTP for AI tools, Claude Code, Cursor, and agents.
---

# Model Context Protocol (MCP) Server

## 1. Protocol Architecture
- Stateless JSON-RPC 2.0 implementation over Streamable HTTP.
- Enables external AI assistants (Cursor, Claude, Copilot, autonomous subagents) to interact directly with Kylrix resources.

## 2. Tools & Capabilities
- 1:1 parity with Kylrix resources: workspaces, notes, goals, calendar events, forms, flows, moments, and agent sessions.
- Operations inherit zero-trust user context and workspace boundaries.
