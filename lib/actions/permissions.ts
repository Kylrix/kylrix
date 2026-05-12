'use server';

import { permissionsInternal } from '@/lib/permissions-server';

export async function permissionsAction(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>
) {
  return await permissionsInternal(method, payload);
}
