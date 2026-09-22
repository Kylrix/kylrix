import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listIdeasCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.ideas.list({ limit, workspaceId: opts.workspace });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((n) => ({
      id: n.id,
      title: n.title || '(Untitled Idea)',
      category: n.category || 'general',
      workspace: n.workspaceId || 'personal',
      createdAt: n.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'category', 'workspace', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list ideas', err);
    process.exit(1);
  }
}

export async function getIdeaCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.ideas.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Idea)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Workspace: ${item.workspaceId || 'personal'}`);
    console.log(`Category:  ${item.category || 'general'}`);
    console.log(`Updated:   ${item.updatedAt || item.createdAt || 'N/A'}`);
    console.log(pc.dim('─'.repeat(40)));
    console.log(item.content || pc.dim('(Empty idea content)'));
    console.log();
  } catch (err: any) {
    printError(`Failed to get idea "${id}"`, err);
    process.exit(1);
  }
}

export async function createIdeaCommand(
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
    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    const item = await client.ideas.create({
      title,
      content: opts.content || '',
      category: opts.category,
      workspaceId: opts.workspace,
      tags,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created idea "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create idea', err);
    process.exit(1);
  }
}

export async function updateIdeaCommand(
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
    const item = await client.ideas.update(id, {
      title: opts.title,
      content: opts.content,
      category: opts.category,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Updated idea "${pc.bold(item.title || item.id)}"`);
  } catch (err: any) {
    printError(`Failed to update idea "${id}"`, err);
    process.exit(1);
  }
}

export async function deleteIdeaCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.ideas.delete(id);

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted idea "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete idea "${id}"`, err);
    process.exit(1);
  }
}

export async function listArticlesCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.ideas.articles({ limit, workspaceId: opts.workspace });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((n) => ({
      id: n.id,
      title: n.title || '(Untitled Article)',
      workspace: n.workspaceId || 'personal',
      createdAt: n.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'workspace', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list articles', err);
    process.exit(1);
  }
}
