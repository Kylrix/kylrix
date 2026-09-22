import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listTagsCommand(opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const res = await client.tags.list();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color || '',
    }));

    printTable(rows, ['id', 'name', 'color']);
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
    const client = requireAuthClient(opts);
    const item = await client.tags.create({
      name,
      color: opts.color,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created tag "${pc.bold(item.name)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create tag', err);
    process.exit(1);
  }
}

export async function deleteTagCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.tags.delete(id);

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
