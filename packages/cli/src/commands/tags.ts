import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listTagsCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    const res = isAuthed
      ? await getClient(opts).tags.list()
      : LocalStore.listTags();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color || '',
      mode: isAuthed ? 'cloud' : pc.dim('local'),
    }));

    printTable(rows, ['id', 'name', 'color', 'mode']);
  } catch (err: any) {
    printError('Failed to list tags', err);
    process.exit(1);
  }
}

export async function createTagCommand(
  name: string,
  opts: { url?: string; token?: string; json?: boolean; color?: string }
) {
  try {
    const isAuthed = hasAuth(opts);
    const payload = {
      name,
      color: opts.color,
    };

    const item = isAuthed
      ? await getClient(opts).tags.create(payload)
      : LocalStore.createTag(payload);

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created tag "${pc.bold(item.name)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create tag', err);
    process.exit(1);
  }
}

export async function deleteTagCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).tags.delete(id);
    } else {
      LocalStore.deleteTag(id);
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted tag "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete tag "${id}"`, err);
    process.exit(1);
  }
}
