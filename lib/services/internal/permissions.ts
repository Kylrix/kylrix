export async function applyPermissionMutation(_actorId: string, _body: any): Promise<any> {
  return { success: true };
}

export async function revokePermissionMutation(_actorId: string, _body: any, _queryTargetUserId?: string | null) {
  return { success: true };
}

export async function permissionsInternal(
  _method: 'POST' | 'DELETE',
  _payload: Record<string, unknown>,
  _actorId?: string
) {
  return { success: true, action: 'grant' };
}
