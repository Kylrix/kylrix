'use server';

import { ID, Permission, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createCallMetadata } from '@/lib/sdk/calls/index';
import { getActor } from './secure-ops';
import { CallInputSchema } from '@/lib/validations/schemas';

// ... (rest of imports)

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

export async function createChatCallAction(input: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const userId = actor.$id;

  // Rigorous runtime validation
  const validated = CallInputSchema.parse(input);

  const durationMinutes = validated.durationMinutes;
  const startTime = new Date();
  const expiresAt = new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString();

  const uniqueParticipants = Array.from(
    new Set([
      ...validated.participantIds,
      userId // Ensure host is always included
    ])
  );

  const scope = 'direct';

  const metadata = createCallMetadata({
    scope,
    hostId: userId,
    sourceApp: 'connect',
    conversationId: validated.conversationId,
    participantIds: uniqueParticipants,
    isPrivate: true,
    allowGuests: false,
    startsAt: startTime.toISOString(),
    expiresAt,
    title: validated.title});

  // Build strict per-participant permissions using System Client
  const permissions = [
    ...uniqueParticipants.map((pId: any) => Permission.read(Role.user(pId)))];

  const systemTables = createSystemTablesDB();

  const result = await systemTables.createRow({
    databaseId: DB_ID,
    tableId: LINKS_TABLE,
    rowId: ID.unique(),
    data: {
      userId,
      type: validated.type,
      expiresAt,
      startsAt: startTime.toISOString(),
      title: validated.title || undefined,
      metadata,
      conversationId: validated.conversationId},
    permissions});

  return { $id: result.$id, callId: result.$id };
}
