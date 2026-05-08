import type { Databases } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export async function deleteCallIfExpired(
  databases: Databases,
  callId?: string | null,
): Promise<{ deleted: boolean; reason?: string }> {
  const normalizedId = String(callId || '').trim();
  if (!normalizedId) return { deleted: false, reason: 'missing_call_id' };

  try {
    const call = await databases.getDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      normalizedId,
    );

    const expiresAtRaw = String((call as any)?.expiresAt || '').trim();
    const expiresAtTs = expiresAtRaw ? new Date(expiresAtRaw).getTime() : NaN;
    const isExpired = !Number.isFinite(expiresAtTs) || expiresAtTs <= Date.now();
    if (!isExpired) return { deleted: false, reason: 'active' };

    await databases.deleteDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      normalizedId,
    );
    return { deleted: true };
  } catch (error: any) {
    const code = Number(error?.code || error?.status || 0);
    if (code === 404) return { deleted: false, reason: 'missing' };
    throw error;
  }
}

