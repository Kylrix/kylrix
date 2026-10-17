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

  return { success: true, prefs: merged };
}

export async function listUserSessionsAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) return { success: false, sessions: [] };

  const allSessions: any[] = [];

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

  if (allSessions.length > 0 && !allSessions.some((s) => s.current)) {
    allSessions[0].current = true;
  }

  return { success: true, sessions: allSessions };
}

export async function revokeUserSessionAction(sessionId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  try {
    await deleteUserSessionTurso(sessionId);
  } catch (err: any) {
    console.warn('[revokeUserSessionAction] Turso delete warning:', err.message);
  }

  return { success: true };
}

export async function revokeAllUserSessionsAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  try {
    const { db } = await import('@/lib/db');
    const { session: sessionTable } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(sessionTable).where(eq(sessionTable.userId, actor.$id));
  } catch (err: any) {
    console.warn('[revokeAllUserSessionsAction] Turso delete warning:', err.message);
  }

  return { success: true };
}

export async function listUserIdentitiesAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) return { identities: [], externals: [] };

  const identities: any[] = [];
  const externals: any[] = [];

  try {
    const { db } = await import('@/lib/db');
    const { account: accountTable, oauthConsent, oauthClient, user: userTable } = await import('@/lib/db/schema');
    const { eq, inArray } = await import('drizzle-orm');
    const allUserIds = [actor.$id];
    if (actor.email) {
      const matchingUsers = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, actor.email.trim().toLowerCase()));
      for (const u of matchingUsers) {
        if (!allUserIds.includes(u.id)) allUserIds.push(u.id);
      }
    }

    const accounts = await db
      .select()
      .from(accountTable)
      .where(inArray(accountTable.userId, allUserIds));

    const seenProviders = new Set<string>();
    for (const a of accounts) {
      const providerKey = (a.providerId || '').toLowerCase();
      if (seenProviders.has(providerKey)) continue;
      seenProviders.add(providerKey);

      identities.push({
        $id: a.id,
        $createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
        provider: a.providerId,
        providerUid: a.accountId,
        providerEmail: actor.email,
      });
    }

    const consents = await db
      .select({
        id: oauthConsent.id,
        clientId: oauthConsent.clientId,
        scopes: oauthConsent.scopes,
        createdAt: oauthConsent.createdAt,
        clientName: oauthClient.name,
        clientUri: oauthClient.uri,
        clientIcon: oauthClient.icon,
      })
      .from(oauthConsent)
      .leftJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
      .where(inArray(oauthConsent.userId, allUserIds));

    for (const c of consents) {
      externals.push({
        identity: {
          $id: c.id,
          $createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
          provider: `oauth2:${c.clientId}`,
        },
        appId: c.clientId,
        app: {
          id: c.clientId,
          name: c.clientName || c.clientId,
          logoUri: c.clientIcon || null,
          homepageUri: c.clientUri || null,
        },
      });
    }
  } catch (err: any) {
    console.warn('[listUserIdentitiesAction] Turso accounts query warning:', err.message);
  }

  return { identities, externals };
}

export async function unlinkUserIdentityAction(identityId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) throw new Error('Unauthorized');

  try {
    const { db } = await import('@/lib/db');
    const { account: accountTable, oauthConsent } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');

    await db
      .delete(accountTable)
      .where(and(eq(accountTable.id, identityId), eq(accountTable.userId, actor.$id)));

    await db
      .delete(oauthConsent)
      .where(and(eq(oauthConsent.id, identityId), eq(oauthConsent.userId, actor.$id)));

    return { success: true };
  } catch (err: any) {
    console.error('[unlinkUserIdentityAction] Error:', err);
    throw new Error(err.message || 'Failed to unlink identity');
  }
}
