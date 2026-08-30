/** Read snake_case query param with optional legacy camelCase alias. */
export function queryParam(params: URLSearchParams, snake: string, camel?: string) {
  return params.get(snake) || (camel ? params.get(camel) : null) || undefined;
}

export function threadParentFilter(params: URLSearchParams) {
  return {
    parentKind: queryParam(params, 'parent_kind', 'parentKind'),
    parentId: queryParam(params, 'parent_id', 'parentId'),
  };
}

export function threadMessageFilter(params: URLSearchParams) {
  return {
    rootMessageId: queryParam(params, 'root_message_id', 'rootMessageId'),
    parentMessageId: queryParam(params, 'parent_message_id', 'parentMessageId'),
    topLevelOnly: params.get('top_level') === '1' || params.get('topLevel') === '1',
  };
}

/** Resolve parent ref from JSON body (snake_case canonical; camelCase accepted). */
export function resolveParentRef(body: Record<string, unknown>) {
  const parentKind = String(body.parent_kind ?? body.parentKind ?? '').trim();
  const parentId = String(body.parent_id ?? body.parentId ?? '').trim();
  return { parentKind, parentId };
}

export function resolveTokenScopeMode(
  body: Record<string, unknown>,
  method: string,
): 'grant' | 'replace' {
  const mode = String(body.mode || '').toLowerCase();
  if (mode === 'grant') return 'grant';
  if (mode === 'replace') return 'replace';
  return method === 'POST' ? 'grant' : 'replace';
}
