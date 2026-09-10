'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { ID, Query } from 'node-appwrite';
import { resolveEffectiveBillingTier } from '@/lib/entitlements/policy';
import { getActor } from './secure-ops/shared';

function isTeamsTierAllowed(prefs: Record<string, unknown> | null | undefined): boolean {
  const tier = resolveEffectiveBillingTier(prefs);
  return tier === 'TEAMS' || tier === 'ORG' || tier === 'LIFETIME';
}

export async function listMyTeamsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  const { teams } = createSystemClient();
  try {
    const res = await teams.list([Query.orderDesc('$createdAt'), Query.limit(100)]);
    return { success: true, teams: res.teams };
  } catch (err: any) {
    console.error('[listMyTeamsSecure] Error:', err);
    throw new Error(err?.message || 'Failed to list teams');
  }
}

export async function createNativeTeamSecure(name: string, roles?: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  if (!name || !name.trim()) {
    throw new Error('Team name is required');
  }

  const { teams } = createSystemClient();
  try {
    const team = await teams.create(ID.unique(), name.trim(), roles && roles.length > 0 ? roles : undefined);
    // Add creator as owner membership
    await teams.createMembership(team.$id, ['owner', 'admin'], undefined, undefined, actor.$id).catch(() => null);
    return { success: true, team };
  } catch (err: any) {
    console.error('[createNativeTeamSecure] Error:', err);
    throw new Error(err?.message || 'Failed to create team');
  }
}

export async function deleteNativeTeamSecure(teamId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  const { teams } = createSystemClient();
  try {
    await teams.delete(teamId);
    return { success: true };
  } catch (err: any) {
    console.error('[deleteNativeTeamSecure] Error:', err);
    throw new Error(err?.message || 'Failed to delete team');
  }
}

export async function getTeamMembershipsSecure(teamId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  const { teams } = createSystemClient();
  try {
    const res = await teams.listMemberships(teamId);
    return { success: true, memberships: res.memberships };
  } catch (err: any) {
    console.error('[getTeamMembershipsSecure] Error:', err);
    throw new Error(err?.message || 'Failed to fetch team memberships');
  }
}

export async function addTeamMemberSecure(input: {
  teamId: string;
  email?: string;
  userId?: string;
  roles?: string[];
  url?: string;
  jwt?: string;
}) {
  const actor = await getActor(input.jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  const { teams } = createSystemClient();
  try {
    const roles = input.roles && input.roles.length > 0 ? input.roles : ['member'];
    const membership = await teams.createMembership(
      input.teamId,
      roles,
      input.url,
      input.email,
      input.userId
    );
    return { success: true, membership };
  } catch (err: any) {
    console.error('[addTeamMemberSecure] Error:', err);
    throw new Error(err?.message || 'Failed to add team member');
  }
}

export async function removeTeamMemberSecure(teamId: string, membershipId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  if (!isTeamsTierAllowed(actor.prefs)) {
    throw new Error('Forbidden: Teams feature is exclusively available on the Teams plan.');
  }

  const { teams } = createSystemClient();
  try {
    await teams.deleteMembership(teamId, membershipId);
    return { success: true };
  } catch (err: any) {
    console.error('[removeTeamMemberSecure] Error:', err);
    throw new Error(err?.message || 'Failed to remove team member');
  }
}
