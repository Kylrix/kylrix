'use server';

import { permissionsInternal } from '@/lib/services/internal/permissions';

export async function permissionsAction(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>
) {
  return await permissionsInternal(method, payload);
}
