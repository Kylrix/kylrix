import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listAgentSessionsCommand(opts: {
  url?: string;
  token?: string;
  workspace?: string;
  harness?: string;
  json?: boolean;
  limit?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const items = await client.agents.listSessions({
      limit,
      harness: opts.harness,
      workspaceId: opts.workspace,
    });

    if (opts.json) {
      printJson(items);
      return;
    }

    const rows = (items || []).map((s: any) => ({
      id: s.id,
      title: s.title || '(Untitled Session)',
      harness: s.harness || 'gemini',
      status: s.status || 'idle',
      workspace: s.workspaceId || 'personal',
      createdAt: s.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['id', 'title', 'harness', 'status', 'workspace', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list agent sessions', err);
    process.exit(1);
  }
}

export async function getAgentSessionCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.agents.getSession(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold(item.title || '(Untitled Agent Session)'));
    console.log(pc.dim('─'.repeat(40)));
    console.log(`ID:        ${item.id}`);
    console.log(`Harness:   ${item.harness || 'gemini'}`);
    console.log(`Status:    ${item.status || 'idle'}`);
    console.log(`Workspace: ${item.workspaceId || 'personal'}`);
    console.log(`Updated:   ${item.updatedAt || item.createdAt || 'N/A'}`);
    if (item.prompt) {
      console.log(pc.dim('─'.repeat(40)));
      console.log(pc.bold('Prompt:'));
      console.log(item.prompt);
    }
    if (item.transcript) {
      console.log(pc.dim('─'.repeat(40)));
      console.log(pc.bold('Transcript:'));
      console.log(typeof item.transcript === 'string' ? item.transcript : JSON.stringify(item.transcript, null, 2));
    }
    console.log();
  } catch (err: any) {
    printError(`Failed to get agent session "${id}"`, err);
    process.exit(1);
  }
}

export async function startAgentSessionCommand(
  title: string,
  opts: {
    url?: string;
    token?: string;
    workspace?: string;
    prompt?: string;
    harness?: string;
    json?: boolean;
  }
) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.agents.createHarnessSession({
      title,
      prompt: opts.prompt,
      harness: opts.harness || 'gemini',
      workspaceId: opts.workspace,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Started agent session "${pc.bold(item.title || item.id)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to start agent session', err);
    process.exit(1);
  }
}

export async function deleteAgentSessionCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.agents.deleteSession(id);

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted agent session "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete agent session "${id}"`, err);
    process.exit(1);
  }
}
