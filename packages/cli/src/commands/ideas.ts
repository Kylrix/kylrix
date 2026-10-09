import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';
import { extractItems } from '../local/sync-resolver';

export async function listIdeasCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
  all?: boolean;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.all || opts.limit === '0' ? 0 : (opts.limit ? parseInt(opts.limit, 10) : 50);
    let cloudWarning: string | null = null;

    // 1. If authed, pull latest ideas from cloud into local SQLite in background
    if (isAuthed) {
      try {
        const client = getClient(opts);
        const cloudRes = await client.ideas.list({ limit: limit || 100, workspaceId: opts.workspace });
        const items = extractItems(cloudRes);
        for (const item of items) {
          LocalStore.upsertIdeaFromCloud(item, opts);
        }
      } catch (err: any) {
        cloudWarning = err?.message || 'Could not sync latest ideas from cloud';
      }
    }

    // 2. Read authoritative local store (contains both local + pulled cloud items)
    const res = LocalStore.listIdeas(opts);

    if (opts.json) {
      printJson({ items: res.items, count: res.count, ...(cloudWarning ? { warning: cloudWarning } : {}) });
      return;
    }

    const allItems = res.items || [];
    const sliced = limit > 0 ? allItems.slice(0, limit) : allItems;
    const rows = sliced.map((n: any) => {
      let syncBadge = pc.yellow('○ unsynced');
      if (n.syncStatus === 'synced') {
        syncBadge = pc.green('● synced');
      } else if (!isAuthed) {
        syncBadge = pc.dim('💻 local');
      }
      return {
        id: n.id,
        title: n.title || '(Untitled Idea)',
        category: n.category || 'general',
        sync: syncBadge,
        updated: (n.updatedAt || n.createdAt)?.substring(0, 10) || '',
      };
    });

    printTable(rows, ['id', 'title', 'category', 'sync', 'updated']);
    if (allItems.length > rows.length) {
      console.log(pc.dim(`\nShowing ${rows.length} of ${allItems.length} ideas. Use --limit <number> or --all to view more.`));
    }
    if (cloudWarning && allItems.length === 0) {
      console.log(pc.yellow(`\n⚠ Cloud note: ${cloudWarning}`));
    }
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
    let item: any;

    try {
      item = LocalStore.getIdea(id);
    } catch {
      if (isAuthed) {
        item = await getClient(opts).ideas.get(id);
        if (item) {
          item = LocalStore.upsertIdeaFromCloud(item);
        }
      }
    }

    if (!item) {
      throw new Error(`Idea not found: ${id}`);
    }

    if (opts.json) {
      printJson(item);
      return;
    }

    let syncBadge = pc.yellow('○ unsynced');
    if (item.syncStatus === 'synced') {
      syncBadge = pc.green('● synced');
    } else if (!isAuthed) {
      syncBadge = pc.dim('💻 local');
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Idea)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Sync:      ${syncBadge}`);
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

    let syncStatus = isAuthed ? 'unsynced' : 'local';

    // 1. Always create locally first (instant local persistence)
    const item = LocalStore.createIdea({
      title,
      content: opts.content,
      category: opts.category,
      tags: tags.length > 0 ? tags : undefined,
      syncStatus,
    });

    // 2. If authed, push to cloud immediately
    if (isAuthed) {
      try {
        const client = getClient(opts);
        const cloudItem = await client.ideas.create({
          title,
          content: opts.content || '',
          workspaceId: opts.workspace,
          tags: tags.length > 0 ? tags : undefined,
        });
        LocalStore.markIdeaSynced(item.id, cloudItem.id);
        item.syncStatus = 'synced';
        item.cloudId = cloudItem.id;
        syncStatus = 'synced';
      } catch {
        // Keeps local item with syncStatus = 'unsynced' for next sync pass
      }
    }

    if (opts.json) {
      printJson(item);
      return;
    }

    const badge =
      syncStatus === 'synced'
        ? pc.green('● synced')
        : syncStatus === 'unsynced'
          ? pc.yellow('○ unsynced')
          : pc.dim('💻 local');

    printSuccess(`Created idea "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${badge}]`);
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
    const item = LocalStore.updateIdea(id, {
      title: opts.title,
      content: opts.content,
      category: opts.category,
    });

    if (isAuthed) {
      try {
        const targetId = item.cloudId || id;
        await getClient(opts).ideas.update(targetId, {
          title: opts.title,
          content: opts.content,
        });
        LocalStore.markIdeaSynced(id, targetId);
      } catch {}
    }

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
    let targetCloudId: string | null = null;
    try {
      const existing = LocalStore.getIdea(id);
      targetCloudId = existing.cloudId || null;
    } catch {}

    LocalStore.deleteIdea(id);

    if (isAuthed) {
      try {
        await getClient(opts).ideas.delete(targetCloudId || id);
      } catch {}
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

    if (isAuthed) {
      try {
        const res = await getClient(opts).ideas.articles({ limit, workspaceId: opts.workspace });
        for (const item of res?.items || []) {
          LocalStore.upsertIdeaFromCloud(item);
        }
      } catch {}
    }

    const all = LocalStore.listIdeas().items.filter((i: any) => i.category === 'article');

    if (opts.json) {
      printJson({ items: all.slice(0, limit), count: all.length });
      return;
    }

    const rows = all.slice(0, limit).map((n: any) => {
      let syncBadge = pc.yellow('○ unsynced');
      if (n.syncStatus === 'synced') {
        syncBadge = pc.green('● synced');
      } else if (!isAuthed) {
        syncBadge = pc.dim('💻 local');
      }
      return {
        id: n.id,
        title: n.title || '(Untitled Article)',
        sync: syncBadge,
        updated: (n.updatedAt || n.createdAt)?.substring(0, 10) || '',
      };
    });

    printTable(rows, ['id', 'title', 'sync', 'updated']);
  } catch (err: any) {
    printError('Failed to list articles', err);
    process.exit(1);
  }
}
