import { spawn } from 'node:child_process';
import pc from 'picocolors';
import { isAgentEnclaveToken, zeroClearBytes, type AetResourceKey } from '@/lib/security/zero-knowledge';
import { openEnclave, type OpenEnclave } from '../enclave';
import { requireAuthClient } from '../client';
import { printError, printInfo, printJson, printSuccess, printTable } from '../formatter';

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

function printAgentKeySummary(enclave: OpenEnclave, keys: AetResourceKey[]) {
  const counts: Record<string, number> = {};
  for (const k of keys) {
    const kind = k.split(':')[0];
    counts[kind] = (counts[kind] || 0) + 1;
  }
  printSuccess(
    `Agent key verified${enclave.expiresAt ? ` — expires ${enclave.expiresAt.slice(0, 10)}` : ' — no expiry'}`
  );
  const labels: Record<string, string> = {
    credential: 'vault item(s)',
    totp: '2FA code(s)',
    note: 'note(s)',
  };
  for (const [kind, n] of Object.entries(counts)) {
    printInfo(`  ${n} ${labels[kind] || `${kind}(s)`} can be opened`);
  }
  if (keys.length === 0) {
    printInfo('  This agent key cannot open any items yet.');
  }
  if (enclave.scopes.length) {
    printInfo(`  Permissions: ${enclave.scopes.join(', ')}`);
  }
}

export async function connectAgentCommand(
  command: string[],
  opts: {
    url?: string;
    token?: string;
    claudeCode?: boolean;
    cursor?: boolean;
    check?: boolean;
  }
) {
  const raw =
    (opts.token && isAgentEnclaveToken(opts.token) ? opts.token : process.env.KYLRIX_AGENT_KEY) || '';
  if (!raw) {
    printError('No agent key found. Set KYLRIX_AGENT_KEY or pass --token.');
    process.exit(1);
  }
  if (opts.token && isAgentEnclaveToken(opts.token)) {
    console.warn(pc.yellow('Your agent key may be saved in shell history. Prefer: export KYLRIX_AGENT_KEY=…'));
  }

  let enclave: OpenEnclave | null = null;
  try {
    enclave = await openEnclave(raw, opts);
    const keys = Object.keys(enclave.envelope.deks) as AetResourceKey[];
    const probe = keys[0] ? await enclave.unlockDek(keys[0]) : null; // proves the unlock part is right
    zeroClearBytes(probe);
    printAgentKeySummary(enclave, keys);

    const bin = opts.claudeCode ? ['claude'] : opts.cursor ? ['cursor-agent'] : command;
    if (opts.check || bin.length === 0) return;

    const childEnv = { ...process.env, KYLRIX_AGENT_KEY: raw };
    delete childEnv.KYLRIX_TOKEN; // the child signs in with the agent key only
    enclave.close(); // the parent no longer needs the unlock bytes
    const child = spawn(bin[0], bin.slice(1), { stdio: 'inherit', env: childEnv });
    child.on('error', (e) => {
      printError(`Could not start ${bin[0]}`, e);
      process.exit(127);
    });
    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
    });
  } catch (err: any) {
    printError('Could not connect agent key', err);
    process.exit(1);
  } finally {
    enclave?.close();
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
