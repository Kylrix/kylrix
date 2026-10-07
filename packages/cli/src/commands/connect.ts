import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import pc from 'picocolors';
import { LocalStore } from '../local/store';
import { printError, printJson, printSuccess, printTable } from '../formatter';
import { hasAuth, getClient } from '../client';
import { loadConfig } from '../config';

export interface DetectResult {
  client: string;
  name: string;
  installed: boolean;
  detectedPaths: string[];
  configSnippet?: string;
}

/**
 * Checks system directories and configurations to autonomously detect installed coding tools.
 */
export function detectCodingTools(targetDir = process.cwd()): DetectResult[] {
  const home = os.homedir();
  const results: DetectResult[] = [];

  // 1. Claude Code / Claude Desktop
  const claudePaths = [
    path.join(home, '.claude'),
    path.join(home, '.config', 'claude'),
    path.join(home, '.claude.json'),
    path.join(home, 'Library', 'Application Support', 'Claude'),
  ];
  const detectedClaude = claudePaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'claude',
    name: 'Claude (Claude Code / Desktop)',
    installed: detectedClaude.length > 0,
    detectedPaths: detectedClaude,
  });

  // 2. Cursor
  const cursorPaths = [
    path.join(home, '.cursor'),
    path.join(home, '.cursor-server'),
    path.join(targetDir, '.cursor'),
    path.join(home, 'Library', 'Application Support', 'Cursor'),
    path.join(home, '.config', 'Cursor'),
  ];
  const detectedCursor = cursorPaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'cursor',
    name: 'Cursor AI IDE',
    installed: detectedCursor.length > 0,
    detectedPaths: detectedCursor,
  });

  // 3. Antigravity / Google Antigravity
  const agyPaths = [
    path.join(home, '.gemini', 'antigravity-cli'),
    path.join(home, '.antigravity'),
    path.join(targetDir, '.agents'),
  ];
  const detectedAgy = agyPaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'antigravity',
    name: 'Antigravity (AGY)',
    installed: detectedAgy.length > 0,
    detectedPaths: detectedAgy,
  });

  // 4. Codex / OpenAI Codex
  const codexPaths = [
    path.join(home, '.codex'),
    path.join(home, '.openai'),
  ];
  const detectedCodex = codexPaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'codex',
    name: 'Codex AI Runner',
    installed: detectedCodex.length > 0,
    detectedPaths: detectedCodex,
  });

  // 5. Windsurf / Codeium
  const windsurfPaths = [
    path.join(home, '.codeium', 'windsurf'),
    path.join(home, '.windsurf'),
    path.join(home, 'Library', 'Application Support', 'Windsurf'),
    path.join(home, '.config', 'Windsurf'),
  ];
  const detectedWindsurf = windsurfPaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'windsurf',
    name: 'Windsurf AI Editor',
    installed: detectedWindsurf.length > 0,
    detectedPaths: detectedWindsurf,
  });

  // 6. VS Code
  const vscodePaths = [
    path.join(home, '.vscode'),
    path.join(targetDir, '.vscode'),
  ];
  const detectedVSCode = vscodePaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'vscode',
    name: 'VS Code',
    installed: detectedVSCode.length > 0,
    detectedPaths: detectedVSCode,
  });

  // 7. Kiro
  const kiroPaths = [
    path.join(home, '.kiro'),
    path.join(targetDir, '.kiro'),
  ];
  const detectedKiro = kiroPaths.filter((p) => fs.existsSync(p));
  results.push({
    client: 'kiro',
    name: 'Kiro AI Client',
    installed: detectedKiro.length > 0,
    detectedPaths: detectedKiro,
  });

  return results;
}

/**
 * Connects an external tool, logs its presence in local storage/silo, creates/links an external workspace
 * and captures cross-tool context for seamless synthesis.
 */
export async function connectCommand(opts: {
  client?: string;
  directory?: string;
  project?: string;
  workspace?: string;
  context?: string;
  detect?: boolean;
  json?: boolean;
  url?: string;
  token?: string;
}) {
  try {
    const targetDir = opts.directory ? path.resolve(opts.directory) : process.cwd();
    const config = loadConfig();
    const activeWs = opts.workspace || opts.project || config.workspaceId;

    // Detection mode if no client specified or --detect requested
    if (!opts.client || opts.detect) {
      const detected = detectCodingTools(targetDir);
      const installedOnly = detected.filter((d) => d.installed);

      if (opts.json) {
        printJson({ targetDirectory: targetDir, detected, activeWorkspace: activeWs || null });
        return;
      }

      console.log('\n' + pc.bold(pc.cyan('🔍 Autonomous Coding Tools Detection:')));
      console.log(pc.dim(`   Directory: ${targetDir}\n`));

      const rows = detected.map((d) => ({
        client: d.client,
        name: d.name,
        status: d.installed ? pc.green('Installed') : pc.dim('Not detected'),
        path: d.detectedPaths[0] || pc.dim('N/A'),
      }));
      printTable(rows, ['client', 'name', 'status', 'path']);

      if (!opts.client) {
        if (installedOnly.length === 0) {
          console.log(pc.yellow('\n⚠ No supported coding tools auto-detected in standard locations.'));
          console.log(`Specify manually with: ${pc.cyan('kylrix connect --client <tool>')}\n`);
          return;
        }

        console.log(pc.dim('\nAuto-connecting detected tools to this local sovereign environment...\n'));
        for (const tool of installedOnly) {
          await connectSingleClient(tool.client, targetDir, activeWs, opts);
        }
        return;
      }
    }

    // Connect specified client
    const clientName = opts.client.toLowerCase().trim();
    await connectSingleClient(clientName, targetDir, activeWs, opts);
  } catch (err: any) {
    printError('Failed to execute connect command', err);
    process.exit(1);
  }
}

async function connectSingleClient(
  clientName: string,
  targetDir: string,
  activeWs: string | undefined,
  opts: { context?: string; json?: boolean; url?: string; token?: string }
) {
  // 1. Record tool locally in SQLite / fallback silo
  const connected = LocalStore.connectTool({
    client: clientName,
    name: clientName.toUpperCase(),
    directory: targetDir,
    workspaceId: activeWs,
    metadata: {
      connectedFrom: 'cli',
      os: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  });

  // 2. Snapshot or synthesize contextual knowledge
  const contextTitle = `Directory Context (${path.basename(targetDir)})`;
  const contextSummary = opts.context || `Connected via ${clientName} in ${targetDir}`;
  const contextRecord = LocalStore.saveExternalContext({
    client: clientName,
    directory: targetDir,
    workspaceId: activeWs,
    title: contextTitle,
    summary: contextSummary,
    payload: {
      connectedAt: new Date().toISOString(),
      directory: targetDir,
      client: clientName,
      customContext: opts.context || null,
    },
  });

  // 3. Synthesize cross-tool context for this directory
  const synthesis = LocalStore.synthesizeContexts(targetDir);

  // 4. If cloud/server auth is available, ensure external workspace representation exists
  let cloudWorkspace = null;
  if (hasAuth(opts)) {
    try {
      const client = getClient(opts);
      const wsName = `${clientName.toUpperCase()} · ${path.basename(targetDir)}`;
      // Create external workspace with metadata tagging
      cloudWorkspace = await client.workspaces.create({
        title: wsName,
        summary: `External workspace connected from ${clientName} on directory ${targetDir}`,
        isAgentic: false,
      } as any).catch(() => null);
    } catch {}
  }

  if (opts.json) {
    printJson({
      status: 'connected',
      client: clientName,
      directory: targetDir,
      workspaceId: activeWs || cloudWorkspace?.id || null,
      context: contextRecord,
      synthesis,
    });
    return;
  }

  printSuccess(`Connected ${pc.bold(pc.green(clientName))} locally!`);
  console.log(`  ${pc.dim('Client:')}    ${pc.bold(clientName)}`);
  console.log(`  ${pc.dim('Directory:')} ${targetDir}`);
  if (activeWs) {
    console.log(`  ${pc.dim('Linked Workspace:')} ${pc.cyan(activeWs)}`);
  }
  console.log(`  ${pc.dim('Cross-tool Clients:')} ${synthesis.clients.join(', ') || clientName}`);
  console.log(`  ${pc.dim('Context Snapshot:')} ${contextTitle} saved locally\n`);
}

/**
 * Inspect connected tools, cross-client context, and synthesized directory memory.
 */
export function connectStatusCommand(opts: { directory?: string; json?: boolean } = {}) {
  try {
    const targetDir = opts.directory ? path.resolve(opts.directory) : process.cwd();
    const tools = LocalStore.listConnectedTools();
    const contexts = LocalStore.listExternalContexts({ directory: targetDir });
    const synthesis = LocalStore.synthesizeContexts(targetDir);

    if (opts.json) {
      printJson({ targetDirectory: targetDir, tools, contexts, synthesis });
      return;
    }

    console.log('\n' + pc.bold(pc.cyan('⚡ Connected Coding Tools & Context:')));
    console.log(pc.dim(`   Directory: ${targetDir}\n`));

    if (tools.length === 0) {
      console.log(pc.dim('  No coding tools connected yet. Run `kylrix connect` to auto-detect.\n'));
      return;
    }

    const toolRows = tools.map((t: any) => ({
      client: t.client,
      name: t.name || t.client,
      status: pc.green(t.status || 'connected'),
      directory: t.directory || pc.dim('N/A'),
      lastActive: t.last_active_at?.substring(0, 19) || t.lastActiveAt?.substring(0, 19) || pc.dim('N/A'),
    }));
    printTable(toolRows, ['client', 'name', 'status', 'directory', 'lastActive']);

    console.log(pc.bold('\n🧠 Synthesized Cross-Tool Knowledge for Directory:'));
    if (contexts.length === 0) {
      console.log(pc.dim('  No contextual snapshots recorded for this directory yet.'));
    } else {
      for (const ctx of contexts) {
        console.log(`  • [${pc.cyan(ctx.client)}] ${pc.bold(ctx.title)} - ${pc.dim(ctx.summary || '')}`);
      }
    }
    console.log('');
  } catch (err: any) {
    printError('Failed to display connect status', err);
    process.exit(1);
  }
}
