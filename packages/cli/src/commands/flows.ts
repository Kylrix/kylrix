import pc from 'picocolors';
import { getClient, hasAuth } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { LocalStore } from '../local/store';

export async function listFlowsCommand(opts: { url?: string; token?: string; json?: boolean; limit?: string }) {
  try {
    const isAuthed = hasAuth(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = isAuthed
      ? await getClient(opts).flows.list(limit)
      : LocalStore.listFlows();

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((f: any) => ({
      id: f.id,
      title: f.title || '(Untitled Flow)',
      status: f.status || 'draft',
      description: f.description || '',
      mode: isAuthed ? 'cloud' : pc.dim('local'),
    }));

    printTable(rows, ['id', 'title', 'status', 'description', 'mode']);
  } catch (err: any) {
    printError('Failed to list flows', err);
    process.exit(1);
  }
}

export async function getFlowCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    const item = isAuthed
      ? await getClient(opts).flows.get(id)
      : LocalStore.getFlow(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Flow)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'draft'}`);
    console.log(`Mode:      ${isAuthed ? 'Cloud' : 'Local-First'}`);
    console.log(`Summary:   ${item.description || 'N/A'}`);
    console.log();
  } catch (err: any) {
    printError(`Failed to get flow "${id}"`, err);
    process.exit(1);
  }
}

export async function createFlowCommand(
  title: string,
  opts: { url?: string; token?: string; json?: boolean; description?: string }
) {
  try {
    const isAuthed = hasAuth(opts);
    const payload = {
      title,
      description: opts.description,
      status: 'draft',
    };

    const item = isAuthed
      ? await getClient(opts).flows.create(payload)
      : LocalStore.createFlow(payload);

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created flow "${pc.bold(item.title || item.id)}" (ID: ${item.id}) [${isAuthed ? 'Cloud' : 'Local'}]`);
  } catch (err: any) {
    printError('Failed to create flow', err);
    process.exit(1);
  }
}

export async function deleteFlowCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const isAuthed = hasAuth(opts);
    if (isAuthed) {
      await getClient(opts).flows.delete(id);
    } else {
      LocalStore.deleteFlow(id);
    }

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted flow "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete flow "${id}"`, err);
    process.exit(1);
  }
}
