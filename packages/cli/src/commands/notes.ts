import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listNotesCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.notes.list({ limit, workspaceId: opts.workspace });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((n) => ({
      id: n.id,
      title: n.title || '(Untitled)',
      category: n.category || 'general',
      workspace: n.workspaceId || 'personal',
      createdAt: n.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'category', 'workspace', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list notes', err);
    process.exit(1);
  }
}

export async function getNoteCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.notes.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Note)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Workspace: ${item.workspaceId || 'personal'}`);
    console.log(`Category:  ${item.category || 'general'}`);
    console.log(`Updated:   ${item.updatedAt || item.createdAt || 'N/A'}`);
    console.log(pc.dim('─'.repeat(40)));
    console.log(item.content || pc.dim('(Empty note content)'));
    console.log();
  } catch (err: any) {
    printError(`Failed to get note "${id}"`, err);
    process.exit(1);
  }
}

export async function createNoteCommand(
  title: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    json?: boolean;
    content?: string;
    category?: string;
    tags?: string;
  }
) {
  try {
    const client = requireAuthClient(opts);
    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    if (opts.category) {
      tags.push(`category:${opts.category}`);
    }
    const item = await client.notes.create({
      title,
      content: opts.content || '',
      workspaceId: opts.workspace,
      tags: tags.length > 0 ? tags : undefined,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created note "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create note', err);
    process.exit(1);
  }
}

export async function updateNoteCommand(
  id: string,
  opts: {
    url?: string;
    token?: string;
    json?: boolean;
    title?: string;
    content?: string;
    category?: string;
  }
) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.notes.update(id, {
      title: opts.title,
      content: opts.content,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Updated note "${pc.bold(item.title || item.id)}"`);
  } catch (err: any) {
    printError(`Failed to update note "${id}"`, err);
    process.exit(1);
  }
}

export async function deleteNoteCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.notes.delete(id);

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted note "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete note "${id}"`, err);
    process.exit(1);
  }
}
