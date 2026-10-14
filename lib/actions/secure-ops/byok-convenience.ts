'use server';

import { getActor } from '../secure-ops/shared';
import { encryptWithKylrixMek, decryptWithKylrixMek } from '@/lib/crypto/kylrix-mek';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export interface AgentByokKeySummary {
  id: string;
  provider: string;
  keyHint: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listAgentByokKeysAction(params?: { jwt?: string }): Promise<AgentByokKeySummary[]> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return [];

    const rows = await db
      .select()
      .from(schema.agentByokKeys)
      .where(eq(schema.agentByokKeys.userId, actor.$id))
      .orderBy(desc(schema.agentByokKeys.createdAt));

    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      keyHint: r.keyHint || r.keyHash || '••••',
      enabled: r.status === 'active',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  } catch (err: any) {
    console.error('Failed to list agent BYOK keys:', err);
    return [];
  }
}

export async function saveAgentByokKeyAction(params: {
  provider: string;
  apiKey: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const cleanKey = params.apiKey.trim();
    if (!cleanKey) throw new Error('API Key cannot be empty');

    const provider = params.provider.trim().toLowerCase();
    if (!provider) throw new Error('Provider cannot be empty');

    const keyHint = cleanKey.length > 8 ? `${cleanKey.slice(0, 4)}…${cleanKey.slice(-4)}` : '••••';
    const encryptedKey = encryptWithKylrixMek(cleanKey);
    const nowIso = new Date().toISOString();
    const rowId = `byok_${actor.$id}_${provider}`;

    const existing = await db
      .select()
      .from(schema.agentByokKeys)
      .where(
        and(
          eq(schema.agentByokKeys.userId, actor.$id),
          eq(schema.agentByokKeys.provider, provider)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      await db
        .update(schema.agentByokKeys)
        .set({
          encryptedKey,
          keyHint,
          keyHash: keyHint,
          status: 'active',
          updatedAt: nowIso,
        })
        .where(eq(schema.agentByokKeys.id, existing[0].id));
    } else {
      await db.insert(schema.agentByokKeys).values({
        id: rowId,
        userId: actor.$id,
        provider,
        keyHint,
        keyHash: keyHint,
        encryptedKey,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    return { success: true, id: rowId, keyHint };
  } catch (err: any) {
    console.error('Failed to save agent BYOK key:', err);
    throw new Error(err.message || 'Failed to save BYOK key');
  }
}

export async function deleteAgentByokKeyAction(params: {
  keyId?: string;
  provider?: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const provider = params.provider ? params.provider.trim().toLowerCase() : undefined;

    if (params.keyId) {
      await db
        .delete(schema.agentByokKeys)
        .where(
          and(
            eq(schema.agentByokKeys.userId, actor.$id),
            eq(schema.agentByokKeys.id, params.keyId)
          )
        );
    } else if (provider) {
      await db
        .delete(schema.agentByokKeys)
        .where(
          and(
            eq(schema.agentByokKeys.userId, actor.$id),
            eq(schema.agentByokKeys.provider, provider)
          )
        );
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete agent BYOK key:', err);
    throw new Error(err.message || 'Failed to delete BYOK key');
  }
}

export async function hasAgentByokKeyAction(params?: { provider?: string; jwt?: string }): Promise<boolean> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return false;

    const provider = (params?.provider || 'gemini').trim().toLowerCase();
    const providerAliases = provider === 'gemini' || provider === 'google' ? ['gemini', 'google'] : [provider];

    const rows = await db
      .select({ id: schema.agentByokKeys.id })
      .from(schema.agentByokKeys)
      .where(
        and(
          eq(schema.agentByokKeys.userId, actor.$id),
          inArray(schema.agentByokKeys.provider, providerAliases),
          eq(schema.agentByokKeys.status, 'active')
        )
      )
      .limit(1);

    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function getDecryptedAgentByokKey(userId: string, provider: string): Promise<string | null> {
  const normProvider = provider.trim().toLowerCase();
  const providerAliases = normProvider === 'gemini' || normProvider === 'google' ? ['gemini', 'google'] : [normProvider];

  try {
    const rows = await db
      .select({ encryptedKey: schema.agentByokKeys.encryptedKey })
      .from(schema.agentByokKeys)
      .where(
        and(
          eq(schema.agentByokKeys.userId, userId),
          inArray(schema.agentByokKeys.provider, providerAliases),
          eq(schema.agentByokKeys.status, 'active')
        )
      )
      .limit(1);

    if (rows && rows.length > 0 && rows[0].encryptedKey) {
      return decryptWithKylrixMek(rows[0].encryptedKey);
    }
  } catch (err) {
    console.warn('[getDecryptedAgentByokKey] Turso query warning:', err);
  }

  return null;
}

export async function enableConvenienceModeAction(params: {
  rawUserMekBase64: string;
  durationSeconds?: number | null;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const encryptedUserMek = encryptWithKylrixMek(params.rawUserMekBase64);
    let expiresAt: string | null = null;
    if (params.durationSeconds && params.durationSeconds > 0) {
      expiresAt = new Date(Date.now() + params.durationSeconds * 1000).toISOString();
    }

    const rowId = `convenience_${actor.$id}`;
    const nowIso = new Date().toISOString();

    const existing = await db
      .select()
      .from(schema.userConvenienceSessions)
      .where(eq(schema.userConvenienceSessions.userId, actor.$id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.userConvenienceSessions)
        .set({
          publicKey: encryptedUserMek,
          expiresAt: expiresAt || undefined,
          lastUsedAt: nowIso,
        })
        .where(eq(schema.userConvenienceSessions.id, existing[0].id));
    } else {
      await db.insert(schema.userConvenienceSessions).values({
        id: rowId,
        userId: actor.$id,
        publicKey: encryptedUserMek,
        expiresAt: expiresAt || undefined,
        createdAt: nowIso,
        lastUsedAt: nowIso,
      });
    }

    return { success: true, expiresAt };
  } catch (err: any) {
    console.error('Failed to enable convenience mode:', err);
    throw new Error(err.message || 'Failed to enable convenience mode');
  }
}

export async function disableConvenienceModeAction(params?: { jwt?: string }) {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) throw new Error('Unauthorized');

    await db
      .delete(schema.userConvenienceSessions)
      .where(eq(schema.userConvenienceSessions.userId, actor.$id));

    return { success: true };
  } catch (err: any) {
    console.error('Failed to disable convenience mode:', err);
    throw new Error(err.message || 'Failed to disable convenience mode');
  }
}

export async function resolveConvenienceMekAction(params?: { jwt?: string }): Promise<{
  active: boolean;
  rawUserMekBase64?: string;
  expiresAt?: string | null;
}> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return { active: false };

    const rows = await db
      .select()
      .from(schema.userConvenienceSessions)
      .where(eq(schema.userConvenienceSessions.userId, actor.$id))
      .limit(1);

    if (rows.length === 0) return { active: false };

    const doc = rows[0];
    if (doc.expiresAt) {
      const exp = new Date(doc.expiresAt).getTime();
      if (Date.now() > exp) {
        await db
          .delete(schema.userConvenienceSessions)
          .where(eq(schema.userConvenienceSessions.id, doc.id))
          .catch(() => {});
        return { active: false };
      }
    }

    const rawUserMekBase64 = doc.publicKey ? decryptWithKylrixMek(doc.publicKey) : undefined;
    return {
      active: true,
      rawUserMekBase64,
      expiresAt: doc.expiresAt || null,
    };
  } catch (err: any) {
    console.error('Failed to resolve convenience MEK:', err);
    return { active: false };
  }
}
