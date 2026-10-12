/**
 * Flow ↔ object binding conventions via the universal `objects` table.
 *
 * Install binding (flow applied to a host resource):
 *   parentKind = host kind (note|goal|form|project|user|…)
 *   parentId   = host row id (or userId for user-scoped)
 *   childKind  = 'flow'
 *   childId    = workflowId
 *   metadata   = { installId, scopeKey, grants? }
 *
 * Never invent a second graph — always attach via objects.
 */

export type FlowScopeType = 'user' | 'object' | 'kind' | 'all';

export type FlowScopeInput =
  | { type: 'user' }
  | { type: 'all' }
  | { type: 'kind'; kind: string }
  | { type: 'object'; kind: string; id: string };

/** Deterministic scope key for unique installs + object metadata. */
export function buildFlowScopeKey(scope: FlowScopeInput): string {
  switch (scope.type) {
    case 'user':
      return 'user';
    case 'all':
      return 'all';
    case 'kind':
      return `kind:${String(scope.kind || '').trim().toLowerCase()}`;
    case 'object':
      return `object:${String(scope.kind || '').trim().toLowerCase()}:${String(scope.id || '').trim()}`;
    default:
      return 'user';
  }
}

export function parseFlowScopeKey(scopeKey: string): FlowScopeInput {
  const key = String(scopeKey || '').trim();
  if (key === 'all') return { type: 'all' };
  if (key === 'user' || !key) return { type: 'user' };
  if (key.startsWith('kind:')) {
    return { type: 'kind', kind: key.slice(5) };
  }
  if (key.startsWith('object:')) {
    const rest = key.slice(7);
    const idx = rest.indexOf(':');
    if (idx === -1) return { type: 'object', kind: rest, id: '' };
    return { type: 'object', kind: rest.slice(0, idx), id: rest.slice(idx + 1) };
  }
  return { type: 'user' };
}

export const FLOW_CHILD_KIND = 'flow' as const;
