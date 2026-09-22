import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listGoalsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  status?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).goals.list({ limit, workspaceId: opts.workspace, status: opts.status })
      : LocalStore.listGoals();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((g: any) => ({
      id: g.id,
      title: g.title || '(Untitled Goal)',
      status: g.status || 'not_started',
      progress: `${g.currentValue ?? 0}/${g.targetValue ?? 100} ${g.unit || ''}`.trim(),
      mode: isAuthed ? (g.workspaceId || 'cloud') : pc.dim('local'),
    }));

    printTable(rows, ['id', 'title', 'status', 'progress', 'mode']);
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
    const item = isAuthed
      ? await getClient(opts).goals.get(id)
      : LocalStore.getGoal(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Goal)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'not_started'}`);
    console.log(`Progress:  ${item.currentValue ?? 0}/${item.targetValue ?? 100} ${item.unit || ''}`);
    console.log(`Mode:      ${isAuthed ? 'Cloud' : 'Local-First'}`);
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
    const item = isAuthed
      ? await getClient(opts).goals.create({
          title,
          description: opts.description,
          status: (opts.status as any) || 'todo',
          workspaceId: opts.workspace,
        })
      : LocalStore.createGoal({
          title,
          description: opts.description,
          targetValue,
          unit: opts.unit,
          status: opts.status,
        });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created goal "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
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
    const item = isAuthed
      ? await getClient(opts).goals.update(id, {
          title: opts.title,
          status: opts.status as any,
        })
      : LocalStore.updateGoal(id, {
          title: opts.title,
          status: opts.status,
          currentValue,
        });

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
    if (isAuthed) {
      await getClient(opts).goals.delete(id);
    } else {
      LocalStore.deleteGoal(id);
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
