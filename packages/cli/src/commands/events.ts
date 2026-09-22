import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listEventsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.events.list({ limit, workspaceId: opts.workspace });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      workspace: e.workspaceId || 'personal',
    }));

    printTable(rows, ['id', 'title', 'startTime', 'endTime', 'workspace']);
  } catch (err: any) {
    printError('Failed to list events', err);
    process.exit(1);
  }
}

export async function createEventCommand(
  title: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    startTime: string;
    endTime: string;
    description?: string;
    json?: boolean;
  }
) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.events.create({
      title,
      startTime: opts.startTime,
      endTime: opts.endTime,
      description: opts.description,
      workspaceId: opts.workspace,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created event "${pc.bold(item.title)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create event', err);
    process.exit(1);
  }
}

export async function deleteEventCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.events.delete(id);

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted event "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete event "${id}"`, err);
    process.exit(1);
  }
}
