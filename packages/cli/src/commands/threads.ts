import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listThreadsCommand(opts: {
  url?: string;
  token?: string;
  json?: boolean;
  parentKind?: string;
  parentId?: string;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.threads.list({
      limit,
      parentKind: opts.parentKind,
      parentId: opts.parentId,
    });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((t) => ({
      id: t.id,
      parentKind: t.parentKind || '',
      parentId: t.parentId || '',
      messages: t.messageCount ?? 0,
      updatedAt: t.updatedAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'parentKind', 'parentId', 'messages', 'updatedAt']);
  } catch (err: any) {
    printError('Failed to list threads', err);
    process.exit(1);
  }
}

export async function listThreadMessagesCommand(
  threadId: string,
  opts: { url?: string; token?: string; json?: boolean; limit?: string }
) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
    const res = await client.threads.messages(threadId, limit);

    if (opts.json) {
      printJson(res);
      return;
    }

    for (const msg of res.items || []) {
      const sender = pc.bold(msg.userId || 'user');
      const time = pc.dim(msg.createdAt?.substring(11, 16) || '');
      console.log(`[${time}] ${sender}: ${msg.content}`);
    }
  } catch (err: any) {
    printError(`Failed to fetch messages for thread "${threadId}"`, err);
    process.exit(1);
  }
}

export async function sendThreadMessageCommand(
  threadId: string,
  content: string,
  opts: { url?: string; token?: string; json?: boolean }
) {
  try {
    const client = requireAuthClient(opts);
    const res = await client.threads.sendMessage(threadId, content);

    if (opts.json) {
      printJson(res);
      return;
    }

    printSuccess(`Message sent to thread "${threadId}"`);
  } catch (err: any) {
    printError('Failed to send thread message', err);
    process.exit(1);
  }
}
