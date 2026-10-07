import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listFormsCommand(opts: {
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
    const res = isAuthed
      ? await getClient(opts).forms.list({ limit: limit || 100, workspaceId: opts.workspace })
      : LocalStore.listForms();

    if (opts.json) {
      printJson(res);
      return;
    }

    const allItems = res.items || [];
    const sliced = limit > 0 ? allItems.slice(0, limit) : allItems;
    const rows = sliced.map((f: any) => ({
      id: f.id,
      title: f.title || '(Untitled Form)',
      status: f.status || 'active',
      fields: Array.isArray(f.schema) ? f.schema.length : 0,
      mode: isAuthed ? (f.workspaceId || 'cloud') : pc.dim('local'),
    }));

    printTable(rows, ['id', 'title', 'status', 'fields', 'mode']);
    if (allItems.length > rows.length) {
      console.log(pc.dim(`\nShowing ${rows.length} of ${allItems.length} forms. Use --limit <number> or --all to view more.`));
    }
  } catch (err: any) {
    printError('Failed to list forms', err);
    process.exit(1);
  }
}

export async function getFormCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    const item = isAuthed
      ? await getClient(opts).forms.get(id)
      : LocalStore.getForm(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Form)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'active'}`);
    console.log(`Mode:      ${isAuthed ? 'Cloud' : 'Local-First'}`);
    console.log(`Fields:    ${Array.isArray(item.schema) ? item.schema.length : 0}`);
    console.log();
  } catch (err: any) {
    printError(`Failed to get form "${id}"`, err);
    process.exit(1);
  }
}

export async function createFormCommand(
  title: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    json?: boolean;
    description?: string;
  }
) {
  try {
    const isAuthed = hasAuth(opts);
    const payload = {
      title,
      description: opts.description,
      workspaceId: opts.workspace,
      schema: [],
    };

    let syncStatus = isAuthed ? 'unsynced' : 'local';

    // 1. Create locally first
    const item = LocalStore.createForm({
      ...payload,
      syncStatus,
    });

    // 2. If authed, push to cloud immediately
    if (isAuthed) {
      try {
        const client = getClient(opts);
        const cloudItem = await client.forms.create(payload);
        LocalStore.markFormSynced(item.id, cloudItem.id);
        item.syncStatus = 'synced';
        item.cloudId = cloudItem.id;
        syncStatus = 'synced';
      } catch {}
    }

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created form "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create form', err);
    process.exit(1);
  }
}

export async function deleteFormCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).forms.delete(id);
    } else {
      LocalStore.deleteForm(id);
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted form "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete form "${id}"`, err);
    process.exit(1);
  }
}
