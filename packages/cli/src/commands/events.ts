import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listEventsCommand(opts: {
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
      ? await getClient(opts).events.list({ limit, workspaceId: opts.workspace })
      : LocalStore.listEvents();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      mode: isAuthed ? (e.workspaceId || 'cloud') : pc.dim('local'),
    }));

    printTable(rows, ['id', 'title', 'startTime', 'endTime', 'mode']);
    if (!isAuthed) {
      console.log(pc.dim('💡 Local-first mode. Run `kylrix login` to sync calendar events with cloud.'));
    }
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
    const isAuthed = hasAuth(opts);
    const payload = {
      title,
      startTime: opts.startTime,
      endTime: opts.endTime,
      description: opts.description,
      workspaceId: opts.workspace,
    };

    const item = isAuthed
      ? await getClient(opts).events.create(payload)
      : LocalStore.createEvent(payload);

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created event "${pc.bold(item.title)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create event', err);
    process.exit(1);
  }
}

export async function deleteEventCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).events.delete(id);
    } else {
      LocalStore.deleteEvent(id);
    }

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
