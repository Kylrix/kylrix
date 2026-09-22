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
}) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).forms.list({ limit, workspaceId: opts.workspace })
      : LocalStore.listForms();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((f: any) => ({
      id: f.id,
      title: f.title || '(Untitled Form)',
      status: f.status || 'active',
      fields: Array.isArray(f.schema) ? f.schema.length : 0,
      mode: isAuthed ? (f.workspaceId || 'cloud') : pc.dim('local'),
    }));

    printTable(rows, ['id', 'title', 'status', 'fields', 'mode']);
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

    const item = isAuthed
      ? await getClient(opts).forms.create(payload)
      : LocalStore.createForm(payload);

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
