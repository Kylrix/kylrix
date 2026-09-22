import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listChatsCommand(opts: { url?: string; token?: string; json?: boolean; limit?: string }) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.chats.list(limit);

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((c) => ({
      id: c.id,
      name: c.name || '(Direct Chat)',
      type: c.type || 'direct',
      updatedAt: c.updatedAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'name', 'type', 'updatedAt']);
  } catch (err: any) {
    printError('Failed to list chats', err);
    process.exit(1);
  }
}

export async function listChatMessagesCommand(
  conversationId: string,
  opts: { url?: string; token?: string; json?: boolean; limit?: string }
) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
    const res = await client.chats.messages(conversationId, limit);

    if (opts.json) {
      printJson(res);
      return;
    }

    for (const msg of res.items || []) {
      const sender = pc.bold(msg.senderId || 'user');
      const time = pc.dim(msg.createdAt?.substring(11, 16) || '');
      console.log(`[${time}] ${sender}: ${msg.content}`);
    }
  } catch (err: any) {
    printError(`Failed to fetch chat messages for "${conversationId}"`, err);
    process.exit(1);
  }
}

export async function sendChatMessageCommand(
  content: string,
  opts: { url?: string; token?: string; json?: boolean; conversationId?: string; participantId?: string }
) {
  try {
    const client = requireAuthClient(opts);
    const res = await client.chats.sendMessage({
      content,
      conversationId: opts.conversationId,
      participantId: opts.participantId,
    });

    if (opts.json) {
      printJson(res);
      return;
    }

    printSuccess('Message sent successfully.');
  } catch (err: any) {
    printError('Failed to send chat message', err);
    process.exit(1);
  }
}
