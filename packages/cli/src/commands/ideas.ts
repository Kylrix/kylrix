import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listIdeasCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).ideas.list({ limit, workspaceId: opts.workspace })
      : LocalStore.listIdeas();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((n: any) => ({
      id: n.id,
      title: n.title || '(Untitled Idea)',
      category: n.category || 'general',
      mode: isAuthed ? (n.workspaceId || 'cloud') : pc.dim('local'),
      createdAt: n.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'category', 'mode', 'createdAt']);
    if (!isAuthed) {
      console.log(pc.dim('💡 Local-first mode. Run `kylrix login` to sync ideas with cloud.'));
    }
  } catch (err: any) {
    printError('Failed to list ideas', err);
    process.exit(1);
  }
}

export async function getIdeaCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    const item = isAuthed
      ? await getClient(opts).ideas.get(id)
      : LocalStore.getIdea(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Idea)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Mode:      ${isAuthed ? 'Cloud / ' + (item.workspaceId || 'personal') : 'Local-First'}`);
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
    const isAuthed = hasAuth(opts);
    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    if (opts.category) {
      tags.push(`category:${opts.category}`);
    }
    const item = isAuthed
      ? await getClient(opts).ideas.create({
          title,
          content: opts.content || '',
          workspaceId: opts.workspace,
          tags: tags.length > 0 ? tags : undefined,
        })
      : LocalStore.createIdea({
          title,
          content: opts.content,
          category: opts.category,
          tags: tags.length > 0 ? tags : undefined,
        });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created idea "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
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
    const isAuthed = hasAuth(opts);
    const item = isAuthed
      ? await getClient(opts).ideas.update(id, {
          title: opts.title,
          content: opts.content,
        })
      : LocalStore.updateIdea(id, {
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
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).ideas.delete(id);
    } else {
      LocalStore.deleteIdea(id);
    }

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
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).ideas.articles({ limit, workspaceId: opts.workspace })
      : {
          items: LocalStore.listIdeas().items.filter((i: any) => i.category === 'article'),
          count: 0,
        };

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((n: any) => ({
      id: n.id,
      title: n.title || '(Untitled Article)',
      mode: isAuthed ? (n.workspaceId || 'cloud') : pc.dim('local'),
      createdAt: n.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'mode', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list articles', err);
    process.exit(1);
  }
}
