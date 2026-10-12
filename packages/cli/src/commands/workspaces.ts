import pc from 'picocolors';
import { requireAuthClient } from '../client';
import { loadConfig, saveConfig, resolveEnvironment } from '../config';
import { printError, printJson, printSuccess, printTable } from '../formatter';

export async function listWorkspacesCommand(opts: {
  url?: string;
  token?: string;
  json?: boolean;
  limit?: string;
  all?: boolean;
  page?: string;
}) {
  try {
    const client = requireAuthClient(opts);
    const limit = opts.all || opts.limit === '0' ? 0 : (opts.limit ? parseInt(opts.limit, 10) : 25);
    const page = opts.page ? Math.max(1, parseInt(opts.page, 10)) : 1;
    const fetchLimit = limit > 0 ? Math.max(100, limit * page) : 100;
    const res = await client.workspaces.list(fetchLimit);
    const activeWs = loadConfig().workspaceId;

    const allItems = res.items || [];
    const total = allItems.length;

    let sliced = allItems;
    if (limit > 0) {
      const offset = (page - 1) * limit;
      sliced = allItems.slice(offset, offset + limit);
    }

    if (opts.json) {
      printJson({ items: sliced, total, page, limit });
      return;
    }

    const rows = sliced.map((w) => ({
      active: w.id === activeWs ? pc.green('✔') : '',
      id: w.id,
      name: w.name,
      description: w.description || '',
      isAgentic: w.isAgentic ? 'yes' : 'no',
      createdAt: w.createdAt?.substring(0, 10) || '',
    }));

    printTable(rows, ['active', 'id', 'name', 'isAgentic', 'description', 'createdAt']);

    if (total > sliced.length) {
      const start = limit > 0 ? (page - 1) * limit + 1 : 1;
      const end = limit > 0 ? Math.min(page * limit, total) : total;
      console.log(pc.dim(`\nShowing ${start}–${end} of ${total} workspaces. Use --page <N> or --all to view more.`));
    }
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
      title: name,
      summary: opts.description,
      isAgentic: opts.agentic,
    });

    if (opts.json) {
      printJson(item);
      return;
    }

    printSuccess(`Created workspace "${pc.bold(item.title || item.name || item.id)}" (ID: ${item.id})`);
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

export async function switchWorkspaceCommand(idOrName: string, opts: { url?: string; token?: string; json?: boolean }) {
  const target = idOrName?.trim();
  if (!target || ['clear', 'personal', 'default', 'none', 'reset', '0', 'account'].includes(target.toLowerCase())) {
    const env = resolveEnvironment(opts);
    if (env.token?.startsWith('kyl_wpat_')) {
      printError('Cannot switch to account-level context: current session is authenticated with a workspace-jailed token.');
      process.exit(1);
    }
    clearWorkspaceCommand(opts);
    return;
  }

  try {
    let matchedWs: any = null;
    let client: any = null;

    try {
      client = requireAuthClient(opts);
    } catch {
      // Offline / unauthenticated mode fallback
    }

    if (client) {
      // 1. Try direct ID lookup first if it looks like an Appwrite ID (hex/alphanumeric ~20 chars)
      if (/^[a-zA-Z0-9_-]{15,36}$/.test(target)) {
        try {
          matchedWs = await client.workspaces.get(target);
        } catch {}
      }

      // 2. If not found by ID, search across all accessible workspaces by name or title
      if (!matchedWs) {
        try {
          const listRes = await client.workspaces.list(100);
          const items = listRes.items || [];
          const query = target.toLowerCase();

          // Exact title/name match
          matchedWs = items.find(
            (w: any) =>
              (w.name && w.name.toLowerCase() === query) ||
              (w.title && w.title.toLowerCase() === query) ||
              w.id.toLowerCase() === query
          );

          // Substring match if exact match not found
          if (!matchedWs) {
            matchedWs = items.find(
              (w: any) =>
                (w.name && w.name.toLowerCase().includes(query)) ||
                (w.title && w.title.toLowerCase().includes(query))
            );
          }

          if (!matchedWs && items.length > 0) {
            const available = items.map((w: any) => `  • ${pc.bold(w.name || w.title || w.id)} (${pc.cyan(w.id)})`).join('\n');
            throw new Error(
              `No workspace found matching "${target}".\n\nAvailable workspaces:\n${available}\n\nTip: Run \`kylrix ws switch <id|name>\` or \`kylrix ws clear\``
            );
          }
        } catch (err: any) {
          if (!/^[a-zA-Z0-9_-]{10,36}$/.test(target)) {
            throw err;
          }
        }
      }
    }

    // If still not matched from API, but target is an ID or alias, save directly to local config
    const finalId = matchedWs ? matchedWs.id : target;
    const wsName = matchedWs?.name || matchedWs?.title || finalId;
    saveConfig({ workspaceId: finalId });

    if (opts.json) {
      printJson({ activeWorkspaceId: finalId, name: wsName, summary: matchedWs?.description || matchedWs?.summary });
      return;
    }

    if (matchedWs) {
      printSuccess(`Switched active workspace to "${pc.bold(wsName)}" (${pc.cyan(matchedWs.id)})`);
    } else {
      printSuccess(`Switched active workspace to "${pc.bold(finalId)}" ${pc.dim('(local config)')}`);
    }
  } catch (err: any) {
    printError(`Failed to switch to workspace "${idOrName}"`, err);
    process.exit(1);
  }
}

export async function currentWorkspaceCommand(opts: { url?: string; token?: string; json?: boolean } = {}) {
  const config = loadConfig();
  const wsId = config.workspaceId;

  if (opts.json) {
    printJson({ workspaceId: wsId || null, mode: wsId ? 'workspace' : 'personal' });
    return;
  }

  if (wsId) {
    try {
      const client = requireAuthClient(opts);
      const ws = await client.workspaces.get(wsId).catch(() => null);
      if (ws) {
        const name = ws.name || ws.title || wsId;
        console.log(`Active Workspace: ${pc.bold(pc.green(name))} (${pc.cyan(wsId)})`);
        if (ws.description || ws.summary) {
          console.log(`     Description: ${pc.dim(ws.description || ws.summary)}`);
        }
        return;
      }
    } catch {}
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
