import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CliConfig {
  apiUrl?: string;
  token?: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.kylrix');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigFileLocation(): string {
  return CONFIG_FILE;
}

export function loadConfig(): CliConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as CliConfig;
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<CliConfig>): CliConfig {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = loadConfig();
    const merged = { ...current, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { encoding: 'utf-8', mode: 0o600 });
    return merged;
  } catch (err: any) {
    throw new Error(`Failed to save config to ${CONFIG_FILE}: ${err.message}`);
  }
}

export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch {}
}

export function resolveEnvironment(cliOptions: { url?: string; token?: string; workspace?: string } = {}) {
  const config = loadConfig();

  const apiUrl =
    cliOptions.url ||
    process.env.KYLRIX_API_URL ||
    config.apiUrl ||
    'https://www.kylrix.space';

  const token =
    cliOptions.token ||
    process.env.KYLRIX_API_KEY ||
    process.env.KYLRIX_PAT ||
    config.token;

  const workspaceId =
    cliOptions.workspace ||
    process.env.KYLRIX_WORKSPACE_ID ||
    config.workspaceId;

  return {
    apiUrl,
    token,
    workspaceId,
  };
}
