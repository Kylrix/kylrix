import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listTrashCommand(opts: { url?: string; token?: string; json?: boolean; limit?: string }) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).trash.list(limit)
      : LocalStore.listTrash();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((t: any) => ({
      id: t.id,
      kind: t.kind,
      title: t.title || '(Untitled)',
      deletedAt: t.deletedAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'kind', 'title', 'deletedAt']);
  } catch (err: any) {
    printError('Failed to list trash', err);
    process.exit(1);
  }
}

export async function restoreTrashCommand(
  kind: string,
  id: string,
  opts: { url?: string; token?: string; json?: boolean }
) {
  try {
    const isAuthed = hasAuth(opts);
    const res = isAuthed
      ? await getClient(opts).trash.restore(kind, id)
      : LocalStore.restoreTrash(kind, id);

    if (opts.json) {
      printJson(res);
      return;
    }

    printSuccess(`Restored ${kind} "${id}"`);
  } catch (err: any) {
    printError(`Failed to restore ${kind} "${id}"`, err);
    process.exit(1);
  }
}

export async function purgeTrashCommand(
  kind: string,
  id: string,
  opts: { url?: string; token?: string; json?: boolean }
) {
  try {
    const isAuthed = hasAuth(opts);
    const res = isAuthed
      ? await getClient(opts).trash.purge(kind, id)
      : LocalStore.purgeTrash(kind, id);

    if (opts.json) {
      printJson(res);
      return;
    }

    printSuccess(`Permanently purged ${kind} "${id}"`);
  } catch (err: any) {
    printError(`Failed to purge ${kind} "${id}"`, err);
    process.exit(1);
  }
}
