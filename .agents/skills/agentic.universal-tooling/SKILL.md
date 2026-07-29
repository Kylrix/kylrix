---
name: agentic.universal-tooling
description: Extend Kylrix agentic engine with universal tool calls (ui.*, objects.*, search.*). Use when wiring Kylie to navigate, CRUD objects, search, workflows, or preview drawers.
---

# Agentic Universal Tooling

Kylrix agents execute **everything via tool calls** — UI navigation, object CRUD, search, drawers, workflows.

## Architecture layers

| Layer | Path | Role |
|-------|------|------|
| Model registry | `lib/agentic/tools-registry.ts` | Tool definitions in Gemini prompt |
| Execution registry | `lib/tools/registry.ts` | Server-capable CRUD/search executors |
| Client executor | `lib/agentic/client-executor.ts` | Browser mutations + navigation |
| UI catalog | `lib/agentic/ui-catalog.ts` | Stable semantic destinations (survives route moves) |
| Search | `lib/agentic/search-engine.ts` | Multi-domain vague query resolution |
| Prompt | `lib/agentic/prompt-framework.ts` | System instruction assembly |
| Spine | `lib/agentic/spine-bridge.ts` | Programmatic agent triggers |
| Workflows | `lib/agentic/workflow-bridge.ts` | Workflow → agent prompt chains |
| Hints | `lib/agentic/hint-engine.ts` | Input-time suggestion providers |
| Preview | `lib/agentic/preview-partition.ts` | Staged commits via LocalEngine |

## Tool naming

- `ui.navigate` — semantic navigation (`target: settings.passkeys`)
- `ui.open_drawer` — masterpass, wallet, agent-select, agentic-preview
- `search.ecosystem` — cross-domain search
- `objects.idea.*` / `objects.goal.*` / `objects.form.*` — CRUD
- Legacy keys (`create_note`, `navigate_workspace`) still work via `tool-bridge.ts`

## Adding a new capability

1. Add semantic UI entry to `ui-catalog.ts` if navigable.
2. Register executor in `lib/tools/registry.ts` (server) if no UI needed.
3. Add client handler in `client-executor.ts` if browser-only.
4. Add model-facing entry in `tools-registry.ts`.
5. Never hardcode routes in prompts — use catalog `target` ids.

## Navigation example

User: "take me to passkeys in settings"

```json
{ "toolKey": "ui.navigate", "args": { "target": "settings.passkeys" } }
```

Resolves to `/settings#passkeys-setup` — route changes only require catalog update.

## Delete safety

`preferences.ts`: `requireDeleteConfirmation` (default true) gates `delete_resource` unless user whitelists in `/settings/agents`.

## Workflows

`workflow-bridge.ts` maps workflow steps → spine events → agent drawer auto-run.
Hook form responses: `onFormResponseReceived(formId, submissionId)`.

## Security

All payloads pass through `redactPIIAndSensitiveFields` in `lib/tools/registry.ts`.
Vault secrets never enter agent context.
