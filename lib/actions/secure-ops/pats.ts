'use server';

import { getActor } from '@/lib/actions/secure-ops';
import { PatService } from '@/lib/services/pats';
import { Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

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
  const tables = createSystemTablesDB();
  const res = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: 'oauth_app_installs',
    queries: [
      Query.equal('userId', actor.$id),
      Query.equal('status', 'active'),
      Query.limit(50),
    ],
  });
  return { success: true, data: res.rows };
}
