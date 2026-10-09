import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';
import { extractItems } from '../local/sync-resolver';

export async function listGoalsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  status?: string;
  json?: boolean;
  limit?: string;
  all?: boolean;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.all || opts.limit === '0' ? 0 : (opts.limit ? parseInt(opts.limit, 10) : 50);
    let cloudWarning: string | null = null;

    // 1. If authed, pull latest goals from cloud into local SQLite in background
    if (isAuthed) {
      try {
        const client = getClient(opts);
        const cloudRes = await client.goals.list({ limit: limit || 100, workspaceId: opts.workspace, status: opts.status });
        const items = extractItems(cloudRes);
        for (const item of items) {
          LocalStore.upsertGoalFromCloud(item, opts);
        }
      } catch (err: any) {
        cloudWarning = err?.message || 'Could not sync latest goals from cloud';
      }
    }

    // 2. Read authoritative local store
    let items = LocalStore.listGoals(opts).items;
    if (opts.status) {
      items = items.filter((g: any) => g.status === opts.status);
    }

    const allItems = items || [];
    const sliced = limit > 0 ? allItems.slice(0, limit) : allItems;

    if (opts.json) {
      printJson({ items: sliced, count: allItems.length, ...(cloudWarning ? { warning: cloudWarning } : {}) });
      return;
    }

    const rows = sliced.map((g: any) => {
      let syncBadge = pc.yellow('○ unsynced');
      if (g.syncStatus === 'synced') {
        syncBadge = pc.green('● synced');
      } else if (!isAuthed) {
        syncBadge = pc.dim('💻 local');
      }
      return {
        id: g.id,
        title: g.title || '(Untitled Goal)',
        status: g.status || 'not_started',
        progress: `${g.currentValue ?? 0}/${g.targetValue ?? 100} ${g.unit || ''}`.trim(),
        sync: syncBadge,
      };
    });

    printTable(rows, ['id', 'title', 'status', 'progress', 'sync']);
    if (allItems.length > rows.length) {
      console.log(pc.dim(`\nShowing ${rows.length} of ${allItems.length} goals. Use --limit <number> or --all to view more.`));
    }
    if (cloudWarning && allItems.length === 0) {
      console.log(pc.yellow(`\n⚠ Cloud note: ${cloudWarning}`));
    }
    if (!isAuthed) {
      console.log(pc.dim('💡 Local-first mode. Run `kylrix login` to sync goals with cloud.'));
    }
  } catch (err: any) {
    printError('Failed to list goals', err);
    process.exit(1);
  }
}

export async function getGoalCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    let item: any;

    try {
      item = LocalStore.getGoal(id);
    } catch {
      if (isAuthed) {
        item = await getClient(opts).goals.get(id);
        if (item) {
          item = LocalStore.upsertGoalFromCloud(item);
        }
      }
    }

    if (!item) {
      throw new Error(`Goal not found: ${id}`);
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

    console.log('\n' + pc.bold(item.title || '(Untitled Goal)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Sync:      ${syncBadge}`);
    console.log(`Status:    ${item.status || 'not_started'}`);
    console.log(`Progress:  ${item.currentValue ?? 0}/${item.targetValue ?? 100} ${item.unit || ''}`);
    if (item.description) {
      console.log(pc.dim('─'.repeat(40)));
      console.log(item.description);
    }
    console.log();
  } catch (err: any) {
    printError(`Failed to get goal "${id}"`, err);
    process.exit(1);
  }
}

export async function createGoalCommand(
  title: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    json?: boolean;
    description?: string;
    targetValue?: string;
    unit?: string;
    status?: string;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const targetValue = opts.targetValue ? parseFloat(opts.targetValue) : 100;

    let syncStatus = isAuthed ? 'unsynced' : 'local';

    // 1. Create locally first
    const item = LocalStore.createGoal({
      title,
      description: opts.description,
      targetValue,
      unit: opts.unit,
      status: opts.status,
      syncStatus,
    });

    // 2. If authed, push to cloud immediately
    if (isAuthed) {
      try {
        const client = getClient(opts);
        const cloudItem = await client.goals.create({
          title,
          description: opts.description,
          status: (opts.status as any) || 'todo',
          workspaceId: opts.workspace,
        });
        LocalStore.markGoalSynced(item.id, cloudItem.id);
        item.syncStatus = 'synced';
        item.cloudId = cloudItem.id;
        syncStatus = 'synced';
      } catch {}
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

    printSuccess(`Created goal "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${badge}]`);
  } catch (err: any) {
    printError('Failed to create goal', err);
    process.exit(1);
  }
}

export async function updateGoalCommand(
  id: string,
  opts: {
    url?: string;
    token?: string;
    json?: boolean;
    title?: string;
    status?: string;
    currentValue?: string;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const currentValue = opts.currentValue !== undefined ? parseFloat(opts.currentValue) : undefined;
    const item = LocalStore.updateGoal(id, {
      title: opts.title,
      status: opts.status,
      currentValue,
    });

    if (isAuthed) {
      try {
        const targetId = item.cloudId || id;
        await getClient(opts).goals.update(targetId, {
          title: opts.title,
          status: opts.status as any,
        });
        LocalStore.markGoalSynced(id, targetId);
      } catch {}
    }

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Updated goal "${pc.bold(item.title || item.id)}"`);
  } catch (err: any) {
    printError(`Failed to update goal "${id}"`, err);
    process.exit(1);
  }
}

export async function deleteGoalCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    let targetCloudId: string | null = null;
    try {
      const existing = LocalStore.getGoal(id);
      targetCloudId = existing.cloudId || null;
    } catch {}

    LocalStore.deleteGoal(id);

    if (isAuthed) {
      try {
        await getClient(opts).goals.delete(targetCloudId || id);
      } catch {}
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted goal "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete goal "${id}"`, err);
    process.exit(1);
  }
}
