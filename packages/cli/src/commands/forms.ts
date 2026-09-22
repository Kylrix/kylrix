import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listFormsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.forms.list({ limit, workspaceId: opts.workspace });

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((f) => ({
      id: f.id,
      title: f.title || '(Untitled Form)',
      status: f.status || 'active',
      fields: Array.isArray(f.schema) ? f.schema.length : 0,
      workspace: f.workspaceId || 'personal',
    }));

    printTable(rows, ['id', 'title', 'status', 'fields', 'workspace']);
  } catch (err: any) {
    printError('Failed to list forms', err);
    process.exit(1);
  }
}

export async function getFormCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.forms.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Form)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'active'}`);
    console.log(`Workspace: ${item.workspaceId || 'personal'}`);
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
    const client = requireAuthClient(opts);
    const item = await client.forms.create({
      title,
      description: opts.description,
      workspaceId: opts.workspace,
      schema: [],
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created form "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create form', err);
    process.exit(1);
  }
}

export async function deleteFormCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.forms.delete(id);

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
