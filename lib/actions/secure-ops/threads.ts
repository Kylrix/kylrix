'use server';

import { getActor } from './shared';
import { ThreadService } from '@/lib/services/threads';
import type { ThreadParentKind } from '@/lib/threads/types';

export async function getOrCreateThreadSecure(data: {
  parentKind: ThreadParentKind | string;
  parentId: string;
  channel?: string;
  title?: string;
  isPublic?: boolean;
  legacyNoteId?: string | null;
  jwt?: string;
}) {
  const actor = await getActor(data.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return ThreadService.getOrCreate({
    parentKind: data.parentKind,
    parentId: data.parentId,
    channel: data.channel,
    ownerId: actor.$id,
    title: data.title,
    isPublic: data.isPublic,
    legacyNoteId: data.legacyNoteId,
  });
}

export async function findThreadSecure(data: {
  parentKind: string;
  parentId: string;
  channel?: string;
  jwt?: string;
}) {
  const actor = await getActor(data.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const scopeKey = ThreadService.buildScopeKey(
    data.parentKind,
    data.parentId,
    data.channel || ThreadService.CHANNEL_GENERAL,
  );
  return ThreadService.findByScopeKey(scopeKey);
}

export async function listThreadMessagesSecure(
  threadId: string,
  opts?: { limit?: number; rootMessageId?: string; topLevelOnly?: boolean },
  jwt?: string,
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const thread = await ThreadService.getById(threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.ownerId !== actor.$id && !thread.isPublic) throw new Error('Forbidden');
  return ThreadService.listMessages(threadId, {
    limit: opts?.limit,
    rootMessageId: opts?.rootMessageId,
    topLevelOnly: opts?.topLevelOnly,
    includeLegacyComments: true,
  });
}

export async function postThreadMessageSecure(data: {
  threadId: string;
  content: string;
  parentMessageId?: string | null;
  jwt?: string;
}) {
  const actor = await getActor(data.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  const thread = await ThreadService.getById(data.threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.ownerId !== actor.$id && !thread.isPublic) throw new Error('Forbidden');
  return ThreadService.postMessage({
    threadId: data.threadId,
    userId: actor.$id,
    content: data.content,
    parentMessageId: data.parentMessageId,
  });
}
