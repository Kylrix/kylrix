import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec, spawn } from 'node:child_process';
import pc from 'picocolors';
import * as clack from '@clack/prompts';

export const PACKAGE_NAME = '@kylrix/cli';
export const CURRENT_VERSION = '1.0.2';

const CACHE_DIR = path.join(os.homedir(), '.kylrix');
const CACHE_FILE = path.join(CACHE_DIR, 'update-cache.json');
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // Check twice a day

interface UpdateCache {
  latestVersion: string;
  lastChecked: number;
}

/**
 * Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('-')[0];
  const clean2 = v2.replace(/^v/, '').split('-')[0];
  const p1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Fast, non-blocking check against the npm registry.
 */
export async function fetchLatestVersion(timeoutMs = 2500): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    return data?.version || null;
  } catch {
    return null;
  }
}

export function readCachedUpdate(): UpdateCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

export function writeCachedUpdate(latestVersion: string): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cache: UpdateCache = {
      latestVersion,
      lastChecked: Date.now(),
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch {}
}

/**
 * Detect package manager used for global CLI.
 */
export function detectPackageManager(): 'pnpm' | 'npm' | 'yarn' | 'bun' {
  const execPath = process.argv[1] || '';
  if (execPath.includes('pnpm')) return 'pnpm';
  if (execPath.includes('yarn')) return 'yarn';
  if (execPath.includes('bun')) return 'bun';
  return 'npm';
}

/**
 * Perform active upgrade command.
 */
export async function executeUpgrade(targetVersion = 'latest'): Promise<void> {
  const pm = detectPackageManager();
  const spinner = clack.spinner();
  spinner.start(`Upgrading ${PACKAGE_NAME} to ${targetVersion} via ${pm}...`);

  const installArgs: Record<string, string[]> = {
    npm: ['install', '-g', `${PACKAGE_NAME}@${targetVersion}`],
    pnpm: ['add', '-g', `${PACKAGE_NAME}@${targetVersion}`],
    yarn: ['global', 'add', `${PACKAGE_NAME}@${targetVersion}`],
    bun: ['add', '-g', `${PACKAGE_NAME}@${targetVersion}`],
  };

  const args = installArgs[pm] || installArgs.npm;

  return new Promise((resolve, reject) => {
    const child = spawn(pm, args, { stdio: 'pipe' });
    let stderr = '';

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        spinner.stop(pc.green(`Successfully upgraded ${PACKAGE_NAME} to ${targetVersion}!`));
        writeCachedUpdate(CURRENT_VERSION);
        resolve();
      } else {
        spinner.stop(pc.red(`Upgrade failed (exit code ${code})`));
        reject(new Error(stderr || `Failed to run ${pm} ${args.join(' ')}`));
      }
    });

    child.on('error', (err) => {
      spinner.stop(pc.red('Failed to launch package manager process'));
      reject(err);
    });
  });
}

/**
 * Print a clean, unobtrusive update banner at the end of execution.
 */
export function printUpdateBanner(latest: string): void {
  const boxWidth = 58;
  const title = `Update available! ${pc.dim(CURRENT_VERSION)} → ${pc.green(pc.bold(latest))}`;
  const pm = detectPackageManager();
  const cmd = pm === 'pnpm' ? `pnpm add -g ${PACKAGE_NAME}` : `npm i -g ${PACKAGE_NAME}`;
  const hint = `Run ${pc.cyan('kylrix update')} or ${pc.cyan(cmd)}`;

  console.error('\n' + pc.yellow('┌' + '─'.repeat(boxWidth) + '┐'));
  console.error(pc.yellow('│') + '  ' + title.padEnd(boxWidth + 12) + pc.yellow('│'));
  console.error(pc.yellow('│') + '  ' + hint.padEnd(boxWidth + 10) + pc.yellow('│'));
  console.error(pc.yellow('└' + '─'.repeat(boxWidth) + '┘') + '\n');
}

/**
 * Background update checker hook called on CLI startup.
 */
export function scheduleBackgroundUpdateCheck(): void {
  // Never run update check if stdio MCP or JSON output is requested
  const isMcp = process.argv.includes('mcp');
  const isJson = process.argv.includes('--json');
  if (isMcp || isJson) return;

  const cached = readCachedUpdate();
  const now = Date.now();

  // If we have recent cache and an update is known, notify on exit
  if (cached && compareSemver(cached.latestVersion, CURRENT_VERSION) > 0) {
    process.on('exit', () => {
      printUpdateBanner(cached.latestVersion);
    });
    return;
  }

  // If cache is stale, perform fast async fetch in background
  if (!cached || now - cached.lastChecked > CHECK_INTERVAL_MS) {
    fetchLatestVersion().then((latest) => {
      if (latest) {
        writeCachedUpdate(latest);
        if (compareSemver(latest, CURRENT_VERSION) > 0) {
          printUpdateBanner(latest);
        }
      }
    }).catch(() => {});
  }
}
