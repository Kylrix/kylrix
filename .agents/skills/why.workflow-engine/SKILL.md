---
name: why.workflow-engine
description: Deep dive into the declarative workflow and task engine in Kylrix. Explains the reversible negations catalog, irreversible actions safety list, hierarchical Action IDs, and noise filters.
---

# Why: Reversible Action Workflows & Hierarchical Action Mapping

**Product routing:** Flow in the UI means **workflows only** at `/flows` (see `system.routing-canonical`). Goals/forms/events are separate surfaces; this engine still powers reversible playbooks across workspaces and productivity objects.

To build smart, automated, and auditable workspaces, we need to track user actions, record sequences of steps as repeatable playbooks (Workflow Chains), and support undoing operations safely.

We achieve this using the **Workflow and Action Engine** in `lib/workflow-engine.ts`.

## 1. Declarative Reversible Negations

Instead of writing custom rollback logic for every button or form field, the engine defines a declarative mapping catalog of inverse operations:

```typescript
export const REVERSIBLE_NEGATIONS: Record<string, string> = {
  // Note/Workspace toggles
  'workspace.note.editor.click.make_public': 'workspace.note.editor.click.make_private',
  'workspace.note.editor.click.make_private': 'workspace.note.editor.click.make_public',
  'workspace.note.editor.click.pin_note': 'workspace.note.editor.click.unpin_note',
  'workspace.note.editor.click.unpin_note': 'workspace.note.editor.click.pin_note',
  // Productivity/Flow toggles
  'productivity.flow.board.click.complete_task': 'productivity.flow.board.click.reopen_task',
};
```

This lets the engine automatically compute the undo action for any given step in a playbook, enabling one-click rollback features.

## 2. Irreversible Action Boundaries

Certain operations represent a permanent deletion or destructive action. The engine enforces an explicit `IRREVERSIBLE_ACTIONS` set to prevent accidental rollbacks or invalid state transitions:

```typescript
export const IRREVERSIBLE_ACTIONS = new Set<string>([
  'workspace.note.editor.click.delete_note',
  'productivity.flow.board.click.delete_task',
  'security.vault.credentials.click.delete_credential',
  'system.settings.click.delete_account'
]);
```

If an action falls within this set, the UI won't allow undo playbooks, protecting the user from accidental data loss.

## 3. Hierarchical Action IDs

To keep telemetry and playback logs consistent, all actions follow a standardized five-tier hierarchical dot-separated notation:

`niche.app.context.action.element` (e.g., `workspace.note.editor.click.save_btn`)

We construct this using a safe sanitization utility:

```typescript
export function makeActionId(
  niche: TelemetryNiche,
  app: string,
  context: string,
  action: string,
  element: string
): string {
  const clean = (str: string) => String(str || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `${clean(niche)}.${clean(app)}.${clean(context)}.${clean(action)}.${clean(element)}`;
}
```

## 4. Intelligent Importance Noise Filtering

High-frequency events (like scroll, hover, or focus changes) clutter playbooks and bloat logs. We filter out this noise by automatically assigning step importance:

```typescript
export function getStepImportance(actionId: string): StepImportance {
  const parts = actionId.split('.');
  const action = parts[3] || '';
  const element = parts[4] || '';
  
  if (
    action.includes('scroll') || 
    action.includes('hover') || 
    action.includes('focus') || 
    element.includes('scrollbar')
  ) {
    return 'low'; // Noise
  }
  return 'high'; // High-signal click, update, or save
}
```

This keeps workflow logs clean and makes auditing user actions efficient.
