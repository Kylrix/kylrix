import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listGoalsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  status?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.goals.list({ limit, workspaceId: opts.workspace, status: opts.status });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((g) => ({
      id: g.id,
      title: g.title || '(Untitled Goal)',
      status: g.status || 'not_started',
      progress: `${g.currentValue ?? 0}/${g.targetValue ?? 100} ${g.unit || ''}`.trim(),
      workspace: g.workspaceId || 'personal',
    }));

    printTable(rows, ['id', 'title', 'status', 'progress', 'workspace']);
  } catch (err: any) {
    printError('Failed to list goals', err);
    process.exit(1);
  }
}

export async function getGoalCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.goals.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Goal)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'not_started'}`);
    console.log(`Progress:  ${item.currentValue ?? 0}/${item.targetValue ?? 100} ${item.unit || ''}`);
    console.log(`Workspace: ${item.workspaceId || 'personal'}`);
    console.log(`Target:    ${item.targetDate || 'No deadline'}`);
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
    const client = requireAuthClient(opts);
    const targetValue = opts.targetValue ? parseFloat(opts.targetValue) : 100;
    const item = await client.goals.create({
      title,
      description: opts.description,
      targetValue,
      unit: opts.unit || '%',
      status: opts.status || 'not_started',
      workspaceId: opts.workspace,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created goal "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
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
    const client = requireAuthClient(opts);
    const currentValue = opts.currentValue !== undefined ? parseFloat(opts.currentValue) : undefined;
    const item = await client.goals.update(id, {
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
    const client = requireAuthClient(opts);
    await client.goals.delete(id);

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
