'use server';

import { getActor } from '@/lib/actions/secure-ops/shared';
import { PatService } from '@/lib/services/pats';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function createPatSecure(params: {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  isWorkspace?: boolean;
  workspaceId?: string | null;
  keyCategory?: import('@/lib/services/pats').PatCategory;
  agentId?: string | null;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return PatService.create({
    userId: actor.$id,
    name: params.name,
    scopes: params.scopes,
    expiresAt: params.expiresAt,
    isWorkspace: params.isWorkspace,
    workspaceId: params.workspaceId,
    keyCategory: params.keyCategory,
    agentId: params.agentId,
  });
}

export async function listPatsSecure(opts?: { 
  isWorkspace?: boolean; 
  workspaceId?: string; 
  category?: import('@/lib/services/pats').PatCategory;
  agentId?: string;
  jwt?: string; 
}) {
  const actor = await getActor(opts?.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const data = await PatService.listForUser(actor.$id, {
    isWorkspace: opts?.isWorkspace,
    workspaceId: opts?.workspaceId,
    category: opts?.category,
    agentId: opts?.agentId,
  });
  return { success: true, data };
}

export async function revokePatSecure(params: { patId: string; jwt?: string }) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  await PatService.revoke({ patId: params.patId, userId: actor.$id });
  return { success: true };
}

export async function listOAuthAppInstallsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  try {
    const rows = await db
      .select()
      .from(schema.oauthConsent)
      .where(eq(schema.oauthConsent.userId, actor.$id));
    return { success: true, data: rows };
  } catch {
    return { success: true, data: [] };
  }
}
