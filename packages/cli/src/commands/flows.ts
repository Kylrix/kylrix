import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listFlowsCommand(opts: { url?: string; token?: string; json?: boolean; limit?: string }) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.flows.list(limit);

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((f) => ({
      id: f.id,
      title: f.title || '(Untitled Flow)',
      status: f.status || 'draft',
      description: f.description || '',
    }));

    printTable(rows, ['id', 'title', 'status', 'description']);
  } catch (err: any) {
    printError('Failed to list flows', err);
    process.exit(1);
  }
}

export async function getFlowCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.flows.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Flow)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Status:    ${item.status || 'draft'}`);
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
    const client = requireAuthClient(opts);
    const item = await client.flows.create({
      title,
      description: opts.description,
      status: 'draft',
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created flow "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create flow', err);
    process.exit(1);
  }
}

export async function deleteFlowCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.flows.delete(id);

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
