import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { loadConfig, saveConfig } from '../config';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listWorkspacesCommand(opts: { url?: string; token?: string; json?: boolean; limit?: string }) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.limit ? parseInt(opts.limit, 10) : 25;
    const res = await client.workspaces.list(limit);
    const activeWs = loadConfig().workspaceId;

    if (opts.json) {
      printJson(res);
      return;
    }

    const rows = (res.items || []).map((w) => ({
      active: w.id === activeWs ? pc.green('✔') : '',
      id: w.id,
      name: w.name,
      description: w.description || '',
      isAgentic: w.isAgentic ? 'yes' : 'no',
      createdAt: w.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['active', 'id', 'name', 'isAgentic', 'description', 'createdAt']);
  } catch (err: any) {
    printError('Failed to list workspaces', err);
    process.exit(1);
  }
}

export async function getWorkspaceCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.workspaces.get(id);

    if (opts.json) {
      printJson(item);
      return;
    }

    console.log('\n' + pc.bold('Workspace Details:'));
    console.log(`  ${pc.dim('ID:')}          ${item.id}`);
    console.log(`  ${pc.dim('Name:')}        ${pc.bold(item.name)}`);
    console.log(`  ${pc.dim('Description:')} ${item.description || 'N/A'}`);
    console.log(`  ${pc.dim('Agentic:')}     ${item.isAgentic ? pc.cyan('yes') : 'no'}`);
    console.log(`  ${pc.dim('Created At:')}  ${item.createdAt || 'N/A'}\n`);
  } catch (err: any) {
    printError(`Failed to get workspace "${id}"`, err);
    process.exit(1);
  }
}

export async function createWorkspaceCommand(
  name: string,
  opts: { url?: string; token?: string; json?: boolean; description?: string; agentic?: boolean }
) {
  try {
    const client = requireAuthClient(opts);
    const item = await client.workspaces.create({
      name,
      description: opts.description,
      isAgentic: opts.agentic,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created workspace "${pc.bold(item.name)}" (ID: ${item.id})`);
  } catch (err: any) {
    printError('Failed to create workspace', err);
    process.exit(1);
  }
}

export async function deleteWorkspaceCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    await client.workspaces.delete(id);

    if (opts.json) {
      printJson({ success: true, id });
      return;
    }

    printSuccess(`Deleted workspace "${id}"`);
  } catch (err: any) {
    printError(`Failed to delete workspace "${id}"`, err);
    process.exit(1);
  }
}

export async function switchWorkspaceCommand(id: string, opts: { url?: string; token?: string; json?: boolean }) {
  try {
    const client = requireAuthClient(opts);
    const ws = await client.workspaces.get(id);

    saveConfig({ workspaceId: ws.id });

    if (opts.json) {
      printJson({ activeWorkspaceId: ws.id, name: ws.name });
      return;
    }

    printSuccess(`Switched active workspace to "${pc.bold(ws.name)}" (${ws.id})`);
  } catch (err: any) {
    printError(`Failed to switch to workspace "${id}"`, err);
    process.exit(1);
  }
}

export function currentWorkspaceCommand(opts: { json?: boolean } = {}) {
  const config = loadConfig();
  const wsId = config.workspaceId;

  if (opts.json) {
    printJson({ workspaceId: wsId || null, mode: wsId ? 'workspace' : 'personal' });
    return;
  }

  if (wsId) {
    console.log(`Active Workspace: ${pc.bold(pc.cyan(wsId))}`);
  } else {
    console.log(`Active Workspace: ${pc.bold('Personal Virtual Workspace')} (no project filter)`);
  }
}

export function clearWorkspaceCommand(opts: { json?: boolean } = {}) {
  saveConfig({ workspaceId: undefined });
  if (opts.json) {
    printJson({ workspaceId: null });
    return;
  }
  printSuccess('Reset active workspace to Personal Virtual Workspace.');
}
