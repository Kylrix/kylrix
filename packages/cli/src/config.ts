import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const DEFAULT_API_URL = 'https://www.kylrix.space';

export interface CliAccountRecord {
  userId: string;
  email?: string;
  name?: string;
  token?: string;
  workspaceId?: string;
  tier?: string;
  scopes?: string[];
  lastUsedAt?: string;
}

export interface CliServerRecord {
  baseUrl: string;
  partitionKey: string;
  activeAccountId?: string;
  accounts: Record<string, CliAccountRecord>;
}

export interface CliMasterConfig {
  currentServer: string;
  servers: Record<string, CliServerRecord>;
  // Flat legacy fields for 100% backward compatibility
  apiUrl?: string;
  token?: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  tier?: string;
}

export type CliConfig = Partial<CliMasterConfig>;

const CONFIG_DIR = path.join(os.homedir(), '.kylrix');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFileLocation(): string {
  return CONFIG_FILE;
}

/**
 * Normalizes a base URL by trimming whitespace, ensuring protocol,
 * and stripping trailing slashes as well as /api or /api/v1 endpoints.
 */
export function normalizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return DEFAULT_API_URL;
  let url = rawUrl.trim();
  if (!url) return DEFAULT_API_URL;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
  return url;
}

/**
 * Derives a filesystem-safe partition key for a base URI.
 * Default cloud URL maps to 'default' for clean directory paths.
 */
export function getBaseUriPartitionKey(rawUrl?: string): string {
  const normalized = normalizeBaseUrl(rawUrl);
  if (normalized === DEFAULT_API_URL || normalized === 'https://kylrix.space') {
    return 'default';
  }
  try {
    const u = new URL(normalized);
    const portPart = u.port ? `_${u.port}` : '';
    const safeHost = `${u.protocol.replace(':', '')}_${u.hostname}${portPart}`;
    return safeHost.replace(/[^a-zA-Z0-9_-]/g, '_');
  } catch {
    return normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

/**
 * Derives a filesystem-safe account silo slug.
 */
export function getAccountSlug(userId?: string): string {
  if (!userId || typeof userId !== 'string') return 'anonymous';
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Resolves the directory path for a specific server partition and account silo.
 */
export function getSiloDir(baseUrl?: string, userId?: string): string {
  const partition = getBaseUriPartitionKey(baseUrl);
  const accountSlug = getAccountSlug(userId);
  const dir = path.join(CONFIG_DIR, 'silos', partition, accountSlug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolves the SQLite database path for a specific partition & silo.
 * Automatically copies existing legacy DB if present so no data is lost.
 */
export function getSiloDbPath(baseUrl?: string, userId?: string): string {
  const dir = getSiloDir(baseUrl, userId);
  const siloDb = path.join(dir, 'local.db');
  const legacyDb = path.join(CONFIG_DIR, 'local.db');
  if (!fs.existsSync(siloDb) && fs.existsSync(legacyDb) && getBaseUriPartitionKey(baseUrl) === 'default') {
    try {
      fs.copyFileSync(legacyDb, siloDb);
    } catch {}
  }
  return siloDb;
}

/**
 * Resolves the fallback JSON store path for a specific partition & silo.
 */
export function getSiloFallbackPath(baseUrl?: string, userId?: string): string {
  const dir = getSiloDir(baseUrl, userId);
  const siloJson = path.join(dir, 'local-store.json');
  const legacyJson = path.join(CONFIG_DIR, 'local-store.json');
  if (!fs.existsSync(siloJson) && fs.existsSync(legacyJson) && getBaseUriPartitionKey(baseUrl) === 'default') {
    try {
      fs.copyFileSync(legacyJson, siloJson);
    } catch {}
  }
  return siloJson;
}

function createEmptyConfig(): CliMasterConfig {
  const defaultServer = DEFAULT_API_URL;
  return {
    currentServer: defaultServer,
    servers: {
      [defaultServer]: {
        baseUrl: defaultServer,
        partitionKey: 'default',
        accounts: {},
      },
    },
    apiUrl: defaultServer,
  };
}

function syncLegacyFields(config: CliMasterConfig, activeServerUrl: string, account?: CliAccountRecord) {
  config.apiUrl = activeServerUrl;
  config.token = account?.token;
  config.userId = account?.userId;
  config.email = account?.email;
  config.workspaceId = account?.workspaceId;
  config.tier = account?.tier;
}

function migrateConfigIfNeeded(parsed: any): CliMasterConfig {
  if (parsed && typeof parsed === 'object' && parsed.servers && typeof parsed.servers === 'object') {
    return parsed as CliMasterConfig;
  }

  // Migrate legacy flat config
  const legacyUrl = normalizeBaseUrl(parsed?.apiUrl || DEFAULT_API_URL);
  const partitionKey = getBaseUriPartitionKey(legacyUrl);
  const config = createEmptyConfig();

  config.currentServer = legacyUrl;
  const legacyUserId = parsed?.userId;

  config.servers[legacyUrl] = {
    baseUrl: legacyUrl,
    partitionKey,
    activeAccountId: legacyUserId,
    accounts: {},
  };

  if (legacyUserId || parsed?.token) {
    const accId = legacyUserId || 'legacy_user';
    config.servers[legacyUrl].activeAccountId = accId;
    config.servers[legacyUrl].accounts[accId] = {
      userId: accId,
      email: parsed?.email,
      token: parsed?.token,
      workspaceId: parsed?.workspaceId,
      tier: parsed?.tier,
      lastUsedAt: new Date().toISOString(),
    };
  }

  syncLegacyFields(config, legacyUrl, legacyUserId ? config.servers[legacyUrl].accounts[legacyUserId] : undefined);
  return config;
}

export function loadConfig(): CliMasterConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return createEmptyConfig();
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return migrateConfigIfNeeded(parsed);
  } catch {
    return createEmptyConfig();
  }
}

export function saveMasterConfig(config: CliMasterConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err: any) {
    throw new Error(`Failed to save config to ${CONFIG_FILE}: ${err.message}`);
  }
}

/**
 * Saves or updates account credentials under a specific server partition.
 */
export function saveConfig(updates: Partial<CliConfig>, targetServerUrl?: string): CliMasterConfig {
  const config = loadConfig();

  const rawUrl = updates.apiUrl || targetServerUrl || config.currentServer || DEFAULT_API_URL;
  const normUrl = normalizeBaseUrl(rawUrl);
  const partitionKey = getBaseUriPartitionKey(normUrl);

  if (!config.servers[normUrl]) {
    config.servers[normUrl] = {
      baseUrl: normUrl,
      partitionKey,
      accounts: {},
    };
  }

  const server = config.servers[normUrl];

  // Determine which account is being updated
  let accId = updates.userId || server.activeAccountId;
  if (!accId) {
    accId = updates.email ? updates.email.replace(/[^a-zA-Z0-9_-]/g, '_') : 'anonymous';
  }

  const existingAcc = server.accounts[accId] || { userId: accId };
  const updatedAcc: CliAccountRecord = {
    ...existingAcc,
    userId: updates.userId || existingAcc.userId || accId,
    email: updates.email !== undefined ? updates.email : existingAcc.email,
    token: updates.token !== undefined ? updates.token : existingAcc.token,
    workspaceId: updates.workspaceId !== undefined ? updates.workspaceId : existingAcc.workspaceId,
    tier: updates.tier !== undefined ? updates.tier : existingAcc.tier,
    lastUsedAt: new Date().toISOString(),
  };

  server.accounts[updatedAcc.userId] = updatedAcc;
  server.activeAccountId = updatedAcc.userId;
  config.currentServer = normUrl;

  syncLegacyFields(config, normUrl, updatedAcc);
  saveMasterConfig(config);
  return config;
}

export function switchAccount(idOrEmail: string, serverUrl?: string): CliAccountRecord {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  const server = config.servers[normUrl];
  if (!server) {
    throw new Error(`Server ${normUrl} is not registered in configuration.`);
  }

  const query = idOrEmail.trim().toLowerCase();
  const accounts = Object.values(server.accounts);
  const matched = accounts.find(
    (a) => a.userId.toLowerCase() === query || (a.email && a.email.toLowerCase() === query)
  );

  if (!matched) {
    const list = accounts.map((a) => a.email || a.userId).join(', ');
    throw new Error(`No account found matching "${idOrEmail}" on server ${normUrl}. Available: ${list || 'none'}`);
  }

  server.activeAccountId = matched.userId;
  matched.lastUsedAt = new Date().toISOString();
  config.currentServer = normUrl;
  syncLegacyFields(config, normUrl, matched);
  saveMasterConfig(config);
  return matched;
}

export function listAccounts(serverUrl?: string): {
  serverUrl: string;
  partitionKey: string;
  activeAccountId?: string;
  accounts: CliAccountRecord[];
} {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  const server = config.servers[normUrl];
  if (!server) {
    return {
      serverUrl: normUrl,
      partitionKey: getBaseUriPartitionKey(normUrl),
      activeAccountId: undefined,
      accounts: [],
    };
  }
  return {
    serverUrl: normUrl,
    partitionKey: server.partitionKey,
    activeAccountId: server.activeAccountId,
    accounts: Object.values(server.accounts),
  };
}

export function removeAccount(idOrEmail: string, serverUrl?: string): boolean {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  const server = config.servers[normUrl];
  if (!server) return false;

  const query = idOrEmail.trim().toLowerCase();
  const accounts = Object.values(server.accounts);
  const matched = accounts.find(
    (a) => a.userId.toLowerCase() === query || (a.email && a.email.toLowerCase() === query)
  );
  if (!matched) return false;

  delete server.accounts[matched.userId];
  if (server.activeAccountId === matched.userId) {
    const remaining = Object.keys(server.accounts);
    server.activeAccountId = remaining.length > 0 ? remaining[0] : undefined;
  }

  const activeAcc = server.activeAccountId ? server.accounts[server.activeAccountId] : undefined;
  syncLegacyFields(config, normUrl, activeAcc);
  saveMasterConfig(config);
  return true;
}

export function clearServerAccounts(serverUrl?: string): void {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl || config.currentServer);
  if (config.servers[normUrl]) {
    config.servers[normUrl].accounts = {};
    config.servers[normUrl].activeAccountId = undefined;
    syncLegacyFields(config, normUrl, undefined);
    saveMasterConfig(config);
  }
}

export function switchServer(serverUrl: string): CliServerRecord {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl);
  if (!config.servers[normUrl]) {
    config.servers[normUrl] = {
      baseUrl: normUrl,
      partitionKey: getBaseUriPartitionKey(normUrl),
      accounts: {},
    };
  }
  config.currentServer = normUrl;
  const server = config.servers[normUrl];
  const activeAcc = server.activeAccountId ? server.accounts[server.activeAccountId] : undefined;
  syncLegacyFields(config, normUrl, activeAcc);
  saveMasterConfig(config);
  return server;
}

export function listServers(): {
  baseUrl: string;
  partitionKey: string;
  isCurrent: boolean;
  activeAccount?: string;
  accountCount: number;
}[] {
  const config = loadConfig();
  const entries = Object.values(config.servers);
  if (entries.length === 0) {
    return [
      {
        baseUrl: DEFAULT_API_URL,
        partitionKey: 'default',
        isCurrent: true,
        accountCount: 0,
      },
    ];
  }
  return entries.map((s) => ({
    baseUrl: s.baseUrl,
    partitionKey: s.partitionKey,
    isCurrent: s.baseUrl === config.currentServer,
    activeAccount: s.activeAccountId ? (s.accounts[s.activeAccountId]?.email || s.activeAccountId) : undefined,
    accountCount: Object.keys(s.accounts).length,
  }));
}

export function removeServer(serverUrl: string): boolean {
  const config = loadConfig();
  const normUrl = normalizeBaseUrl(serverUrl);
  if (!config.servers[normUrl]) return false;

  delete config.servers[normUrl];
  if (config.currentServer === normUrl) {
    const remaining = Object.keys(config.servers);
    config.currentServer = remaining.length > 0 ? remaining[0] : DEFAULT_API_URL;
  }
  const curServer = config.servers[config.currentServer];
  const activeAcc = curServer?.activeAccountId ? curServer.accounts[curServer.activeAccountId] : undefined;
  syncLegacyFields(config, config.currentServer, activeAcc);
  saveMasterConfig(config);
  return true;
}

export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch {}
}

/**
 * Resolves current environment respecting precedence:
 * cliOptions > environment variables > active account on active server > defaults.
 */
export function resolveEnvironment(cliOptions: { url?: string; token?: string; workspace?: string } = {}) {
  const config = loadConfig();

  const rawUrl = cliOptions.url || process.env.KYLRIX_API_URL || config.currentServer || DEFAULT_API_URL;
  const apiUrl = normalizeBaseUrl(rawUrl);
  const partitionKey = getBaseUriPartitionKey(apiUrl);

  const server = config.servers[apiUrl];
  const account = server?.activeAccountId ? server.accounts[server.activeAccountId] : undefined;

  const token =
    cliOptions.token ||
    process.env.KYLRIX_API_KEY ||
    process.env.KYLRIX_PAT ||
    account?.token ||
    config.token;

  const workspaceId =
    cliOptions.workspace ||
    process.env.KYLRIX_WORKSPACE_ID ||
    account?.workspaceId ||
    config.workspaceId;

  const userId = account?.userId || config.userId;
  const email = account?.email || config.email;
  const tier = account?.tier || config.tier;

  const siloDir = getSiloDir(apiUrl, userId);
  const siloDbPath = getSiloDbPath(apiUrl, userId);
  const siloFallbackPath = getSiloFallbackPath(apiUrl, userId);

  return {
    apiUrl,
    token,
    workspaceId,
    userId,
    email,
    tier,
    serverBaseUrl: apiUrl,
    partitionKey,
    activeAccountId: account?.userId,
    siloDir,
    siloDbPath,
    siloFallbackPath,
  };
}
