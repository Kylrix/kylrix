# Agentic modular surface

## Use

```ts
import {
  runInstantAgenticRequest,
  resolveAgenticPageContext,
  getQuickWorkflows,
  userMayUsePaidAi,
  AI_UPGRADE_LABEL,
} from '@/lib/agentic';
```

## Layers

| Module | Role |
|--------|------|
| `access.ts` | Shared Pro/Teams gate helpers (client assert + labels) |
| `runtime.ts` | One-shot `runInstantAgenticRequest` — no drawer/session UI |
| `tools-registry.ts` | Tool definitions for the model |
| `context-workflows.ts` | Page context + quick workflows |
| `index.ts` | Public barrel |

## Rules

1. **Paid AI** is enforced in UI (`userMayUsePaidAi` / upgrade) **and** server (`userHasPaidAiAccess` / `generateAIContent` / `checkComputeBalance`).
2. **Sessions** stay in `AgenticPanelContent` — one-shot suite helpers must not invent session state.
3. Do not fork tool execution into new copies; extend `runtime` / server actions instead.
4. Milestone generate may later call `runInstantAgenticRequest` or stay on `useAI` + server gate — both must remain Pro/Teams.
