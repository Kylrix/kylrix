'use server';

import { ID, Permission, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createCallMetadata } from '@/lib/sdk/calls/index';
import { createServerClient } from '@/lib/appwrite/server';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

export async function createChatCallAction(input: {
  conversationId: string;
  participantIds: string[];
  type?: 'audio' | 'video';
  title?: string;
  durationMinutes?: number;
  scope?: 'direct' | 'group';
}) {
  const { account } = await createServerClient();
  const actor = await account.get();
  const userId = actor.$id;

  const durationMinutes = input.durationMinutes ?? 120;
  const startTime = new Date();
  const expiresAt = new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString();

  const uniqueParticipants = Array.from(
    new Set(
      input.participantIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  // Ensure the host is always included
  if (!uniqueParticipants.includes(userId)) {
    uniqueParticipants.unshift(userId);
  }

  const metadata = createCallMetadata({
    scope: input.scope || (uniqueParticipants.length > 2 ? 'group' : 'direct'),
    hostId: userId,
    sourceApp: 'connect',
    conversationId: input.conversationId,
    participantIds: uniqueParticipants,
    isPrivate: true,
    allowGuests: false,
    startsAt: startTime.toISOString(),
    expiresAt,
    title: input.title,
  });

  // Build strict per-participant permissions using System Client
  const permissions = [
    ...uniqueParticipants.map((pId) => Permission.read(Role.user(pId)))];

  const systemTables = createSystemTablesDB();

  const result = await systemTables.createRow({
    databaseId: DB_ID,
    tableId: LINKS_TABLE,
    rowId: ID.unique(),
    data: {
      userId,
      type: input.type || 'audio',
      expiresAt,
      startsAt: startTime.toISOString(),
      title: input.title || undefined,
      metadata,
      conversationId: input.conversationId,
    },
    permissions,
  });

  return { $id: result.$id, callId: result.$id };
}
