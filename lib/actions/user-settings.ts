'use server';

import { getActor } from '@/lib/actions/secure-ops';
import {
  getUserSettingsTurso,
  upsertUserSettingsTurso,
  listUserSessionsTurso,
  deleteUserSessionTurso,
} from '@/lib/actions/turso-ops';

export async function getUserPreferencesAction(jwt?: string): Promise<Record<string, any>> {
  const actor = await getActor(jwt);
  if (!actor) return {};

  let prefs: Record<string, any> = {};

  // 1. Try Turso SQLite userSettings table
  try {
    const res = await getUserSettingsTurso(actor.$id);
    if (res.success && res.settings?.preferences) {
      try {
        prefs = JSON.parse(res.settings.preferences);
      } catch {}
    }
  } catch (err: any) {
    console.warn('[getUserPreferencesAction] Turso query warning:', err.message);
  }

  // 2. Merge with actor prefs if available
  if (actor.prefs && typeof actor.prefs === 'object') {
    prefs = { ...actor.prefs, ...prefs };
  }

  return prefs;
}

export async function updateUserPreferencesAction(
  newPrefs: Record<string, any>,
  jwt?: string
): Promise<{ success: boolean; prefs: Record<string, any> }> {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  const merged = { ...(actor.prefs || {}), ...newPrefs };

  // 1. Save to Turso SQLite
  try {
    await upsertUserSettingsTurso({
      id: `settings-${actor.$id}`,
      userId: actor.$id,
      preferences: JSON.stringify(merged),
      securityFlags: '{}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('[updateUserPreferencesAction] Turso save warning:', err.message);
  }

  // 2. Sync to Appwrite if available
  try {
    if (process.env.APPWRITE_API) {
      const { createAdminClient } = await import('@/lib/appwrite-admin');
      const { users } = createAdminClient(actor.email);
      await users.updatePrefs(actor.$id, merged);
    }
  } catch (_e) {
    // Non-fatal if Appwrite is not configured
  }

  return { success: true, prefs: merged };
}

export async function listUserSessionsAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) return { success: false, sessions: [] };

  const allSessions: any[] = [];

  // 1. Primary: Turso SQLite session table
  try {
    const tursoRes = await listUserSessionsTurso(actor.$id);
    if (tursoRes.success && Array.isArray(tursoRes.sessions) && tursoRes.sessions.length > 0) {
      for (const s of tursoRes.sessions) {
        allSessions.push({
          $id: s.id,
          $createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          userId: s.userId,
          expire: s.expiresAt ? new Date(s.expiresAt).toISOString() : '',
          ip: s.ipAddress || '127.0.0.1',
          clientName: s.userAgent || 'Web Browser',
          osName: '',
          deviceType: /mobile|android|iphone/i.test(s.userAgent || '') ? 'mobile' : 'desktop',
          current: false,
        });
      }
    }
  } catch (err: any) {
    console.warn('[listUserSessionsAction] Turso sessions warning:', err.message);
  }

  // 2. Secondary: If needed, query Appwrite sessions with strict 1.5s timeout & migration gate
  try {
    const { resolveUserAppwriteMigrationGate } = await import('@/lib/actions/turso-ops');
    const gate = await resolveUserAppwriteMigrationGate({ userId: actor.$id });
    if (!gate.shouldSkipAppwrite) {
      const { createServerClient } = await import('@/lib/appwrite/server');
      const { account } = await createServerClient(jwt);
      const appwritePromise = account.listSessions().catch(() => null);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const appwriteList = await Promise.race([appwritePromise, timeoutPromise]);
      if (appwriteList?.sessions) {
        for (const s of appwriteList.sessions) {
          if (!allSessions.some((item) => item.$id === s.$id)) {
            allSessions.push(s);
          }
        }
      }
    }
  } catch {}

  // Fallback: If no sessions are stored, create a local active session entry so user gets instant UI
  if (allSessions.length === 0) {
    allSessions.push({
      $id: `sess-${actor.$id}`,
      $createdAt: new Date().toISOString(),
      userId: actor.$id,
      expire: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ip: '127.0.0.1',
      clientName: 'Active Browser Session',
      osName: '',
      deviceType: 'desktop',
      current: true,
    });
  }

  // Mark at least one as current if none marked
  if (allSessions.length > 0 && !allSessions.some((s) => s.current)) {
    allSessions[0].current = true;
  }

  return { success: true, sessions: allSessions };
}

export async function revokeUserSessionAction(sessionId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  // 1. Delete from Turso
  try {
    await deleteUserSessionTurso(sessionId);
  } catch (err: any) {
    console.warn('[revokeUserSessionAction] Turso delete warning:', err.message);
  }

  // 2. Delete from Appwrite if available
  try {
    const { createServerClient } = await import('@/lib/appwrite/server');
    const { account } = await createServerClient(jwt);
    await account.deleteSession(sessionId).catch(() => null);
  } catch {}

  return { success: true };
}

export async function listUserIdentitiesAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) return { identities: [], externals: [] };

  const identities: any[] = [];

  // Strictly query Turso SQLite account table (Better Auth linked accounts)
  try {
    const { db } = await import('@/lib/db');
    const { account: accountTable } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const accounts = await db.select().from(accountTable).where(eq(accountTable.userId, actor.$id));
    for (const a of accounts) {
      identities.push({
        $id: a.id,
        $createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
        provider: a.providerId,
        providerUid: a.accountId,
        providerEmail: actor.email,
      });
    }
  } catch (err: any) {
    console.warn('[listUserIdentitiesAction] Turso accounts query warning:', err.message);
  }

  return { identities, externals: [] };
}

export async function unlinkUserIdentityAction(identityId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  try {
    const { db } = await import('@/lib/db');
    const { account: accountTable } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');

    await db
      .delete(accountTable)
      .where(and(eq(accountTable.id, identityId), eq(accountTable.userId, actor.$id)));
    return { success: true };
  } catch (err: any) {
    console.error('[unlinkUserIdentityAction] Error:', err);
    throw new Error(err.message || 'Failed to unlink identity');
  }
}
