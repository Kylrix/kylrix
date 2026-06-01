'use server';

import { permissionsInternal } from '@/lib/services/internal/permissions';
import { getActor } from './secure-ops';

export async function permissionsAction(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  // Ensure the actorId in payload matches the authenticated actor
  const securedPayload = {
    ...payload,
    actorId: actor.$id,
  };

  return await permissionsInternal(method, securedPayload);
}
