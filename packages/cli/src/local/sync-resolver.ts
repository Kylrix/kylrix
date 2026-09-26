import * as fs from 'node:fs';
import * as path from 'node:path';
import pc from 'picocolors';
import {
  getConfigDir,
  loadConfig,
  saveMasterConfig,
  normalizeBaseUrl,
  getBaseUriPartitionKey,
  getAccountSlug,
  DEFAULT_API_URL,
  DEFAULT_OFFLINE_ACCOUNT,
} from '../config';
import { getNativeSqlite, getDatabase } from './sqlite';
import { getClient } from '../client';
import { printSuccess } from '../formatter';

export interface OfflineContainerInfo {
  name: string;
  path: string;
  dbPath: string;
  fallbackPath: string;
  itemCount: number;
  isDefault: boolean;
}

export interface AutoSyncVerdict {
  canAutoSync: boolean;
  reason?: string;
  sourceContainer?: string;
  itemCount: number;
  containers: OfflineContainerInfo[];
}

/**
 * Counts total local objects stored inside an offline container (SQLite or fallback JSON).
 */
export function countLocalContainerItems(dbPath: string, fallbackPath: string): number {
  let count = 0;

  if (fs.existsSync(dbPath)) {
    try {
      const DatabaseSync = getNativeSqlite();
      if (DatabaseSync) {
        const db = new DatabaseSync(dbPath);
        const tables = ['ideas', 'goals', 'vault', 'totp', 'events', 'forms', 'flows'];
        for (const tbl of tables) {
          try {
            const row = db.prepare(`SELECT count(*) as c FROM ${tbl}`).get() as any;
            count += Number(row?.c || 0);
          } catch {}
        }
        try {
          db.close();
        } catch {}
      }
    } catch {}
  }

  if (count === 0 && fs.existsSync(fallbackPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      for (const k of Object.keys(parsed)) {
        if (Array.isArray(parsed[k])) {
          count += parsed[k].length;
        }
      }
    } catch {}
  }

  return count;
}

/**
 * Lists all offline/unauthenticated containers present under a partition.
 * Filters out registered authenticated accounts.
 */
export function listOfflineContainers(partitionKey = 'default'): OfflineContainerInfo[] {
  const partitionDir = path.join(getConfigDir(), 'silos', partitionKey);
  if (!fs.existsSync(partitionDir)) {
    return [];
  }

  const config = loadConfig();
  const knownAccountSlugs = new Set<string>();

  for (const server of Object.values(config.servers)) {
    if (server.partitionKey === partitionKey) {
      for (const acc of Object.values(server.accounts)) {
        knownAccountSlugs.add(getAccountSlug(acc.userId));
      }
    }
  }

  const defaultSource = config.defaultSyncSource || DEFAULT_OFFLINE_ACCOUNT;
  const entries = fs.readdirSync(partitionDir, { withFileTypes: true });
  const result: OfflineContainerInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !knownAccountSlugs.has(entry.name)) {
      const dirPath = path.join(partitionDir, entry.name);
      const dbPath = path.join(dirPath, 'local.db');
      const fallbackPath = path.join(dirPath, 'local-store.json');
      const count = countLocalContainerItems(dbPath, fallbackPath);

      result.push({
        name: entry.name,
        path: dirPath,
        dbPath,
        fallbackPath,
        itemCount: count,
        isDefault: entry.name === defaultSource,
      });
    }
  }

  // Ensure 'default' container is at least represented if empty
  if (!result.some((c) => c.name === DEFAULT_OFFLINE_ACCOUNT)) {
    const dirPath = path.join(partitionDir, DEFAULT_OFFLINE_ACCOUNT);
    result.unshift({
      name: DEFAULT_OFFLINE_ACCOUNT,
      path: dirPath,
      dbPath: path.join(dirPath, 'local.db'),
      fallbackPath: path.join(dirPath, 'local-store.json'),
      itemCount: 0,
      isDefault: defaultSource === DEFAULT_OFFLINE_ACCOUNT,
    });
  }

  return result;
}

/**
 * Evaluates whether offline data can automatically sync to a newly logged-in account:
 * - Server partition must belong to standard Kylrix base URI ('default' partition).
 * - Target account must be the first/initial account on this partition (not already earmarked to another profile).
 * - Exactly one offline container with data (or explicit defaultSyncSource with data).
 */
export function evaluateOfflineAutoSync(targetServerUrl?: string, targetUserId?: string): AutoSyncVerdict {
  const config = loadConfig();
  const rawUrl = targetServerUrl || config.currentServer || DEFAULT_API_URL;
  const normUrl = normalizeBaseUrl(rawUrl);
  const partitionKey = getBaseUriPartitionKey(normUrl);

  const containers = listOfflineContainers('default');
  const defaultSource = config.defaultSyncSource || DEFAULT_OFFLINE_ACCOUNT;

  // 1. Must belong to standard Kylrix base URI partition
  if (partitionKey !== 'default') {
    return {
      canAutoSync: false,
      reason: `Offline local data resides in default partition, but active server (${normUrl}) uses a custom partition "${partitionKey}".`,
      itemCount: 0,
      containers,
    };
  }

  // 2. Server partition must not already be earmarked to multiple accounts
  const server = config.servers[normUrl];
  const registeredAccounts = server ? Object.keys(server.accounts) : [];
  const isFirstAccount =
    registeredAccounts.length <= 1 ||
    (registeredAccounts.length === 1 && registeredAccounts[0] === targetUserId);

  if (!isFirstAccount) {
    return {
      canAutoSync: false,
      reason: `Partition "${partitionKey}" already contains multiple accounts or was previously earmarked to an existing profile.`,
      itemCount: 0,
      containers,
    };
  }

  const containersWithData = containers.filter((c) => c.itemCount > 0);
  if (containersWithData.length === 0) {
    return {
      canAutoSync: false,
      itemCount: 0,
      containers,
    };
  }

  // 3. If explicit defaultSyncSource has data, prioritize it
  const explicitDefault = containersWithData.find((c) => c.name === defaultSource);

  // If there are multiple offline containers with data and none explicitly designated
  if (containersWithData.length > 1 && !explicitDefault) {
    const list = containersWithData.map((c) => `"${c.name}" (${c.itemCount} items)`).join(', ');
    return {
      canAutoSync: false,
      reason: `Multiple offline containers with data detected: ${list}. Automatic sync was paused to prevent overwriting. Use \`kylrix accounts sync-source <container>\` to select your sync point.`,
      itemCount: containersWithData.reduce((acc, c) => acc + c.itemCount, 0),
      containers,
    };
  }

  const chosen = explicitDefault || containersWithData[0];
  return {
    canAutoSync: true,
    sourceContainer: chosen.name,
    itemCount: chosen.itemCount,
    containers,
  };
}

/**
 * Migrates local SQLite rows and fallback store items from an offline container
 * into the authenticated account's silo, and cleans up the source container.
 */
export function migrateOfflineData(
  sourceContainer: string,
  targetUserId: string,
  partitionKey = 'default'
): { total: number; ideas: number; goals: number; events: number; forms: number; flows: number } {
  const targetAccountSlug = getAccountSlug(targetUserId);
  const sourceDir = path.join(getConfigDir(), 'silos', partitionKey, sourceContainer);
  const targetDir = path.join(getConfigDir(), 'silos', partitionKey, targetAccountSlug);

  const sourceDbPath = path.join(sourceDir, 'local.db');
  const targetDbPath = path.join(targetDir, 'local.db');

  let total = 0;
  let ideas = 0;
  let goals = 0;
  let events = 0;
  let forms = 0;
  let flows = 0;

  const DatabaseSync = getNativeSqlite();
  if (DatabaseSync && fs.existsSync(sourceDbPath)) {
    try {
      const sourceDb = new DatabaseSync(sourceDbPath);
      const targetDb = getDatabase(targetDbPath);

      if (targetDb) {
        // Ideas
        try {
          const rows = sourceDb.prepare('SELECT * FROM ideas').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare(
                'INSERT OR IGNORE INTO ideas (id, title, content, category, tags, is_local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
              )
              .run(r.id, r.title, r.content, r.category, r.tags, r.created_at, r.updated_at);
            ideas++;
            total++;
          }
          sourceDb.prepare('DELETE FROM ideas').run();
        } catch {}

        // Goals
        try {
          const rows = sourceDb.prepare('SELECT * FROM goals').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare(
                'INSERT OR IGNORE INTO goals (id, title, description, target_value, current_value, unit, status, is_local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
              )
              .run(r.id, r.title, r.description, r.target_value, r.current_value, r.unit, r.status, r.created_at, r.updated_at);
            goals++;
            total++;
          }
          sourceDb.prepare('DELETE FROM goals').run();
        } catch {}

        // Events
        try {
          const rows = sourceDb.prepare('SELECT * FROM events').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare('INSERT OR IGNORE INTO events (id, title, start_time, end_time, description, is_local, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
              .run(r.id, r.title, r.start_time, r.end_time, r.description, r.created_at);
            events++;
            total++;
          }
          sourceDb.prepare('DELETE FROM events').run();
        } catch {}

        // Forms
        try {
          const rows = sourceDb.prepare('SELECT * FROM forms').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare('INSERT OR IGNORE INTO forms (id, title, description, schema, is_local, created_at) VALUES (?, ?, ?, ?, 1, ?)')
              .run(r.id, r.title, r.description, r.schema, r.created_at);
            forms++;
            total++;
          }
          sourceDb.prepare('DELETE FROM forms').run();
        } catch {}

        // Flows
        try {
          const rows = sourceDb.prepare('SELECT * FROM flows').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare('INSERT OR IGNORE INTO flows (id, title, description, status, is_local, created_at) VALUES (?, ?, ?, ?, 1, ?)')
              .run(r.id, r.title, r.description, r.status, r.created_at);
            flows++;
            total++;
          }
          sourceDb.prepare('DELETE FROM flows').run();
        } catch {}

        // Vault
        try {
          const rows = sourceDb.prepare('SELECT * FROM vault').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare(
                'INSERT OR IGNORE INTO vault (id, name, username, password, url, notes, is_env, custom_fields, item_type, is_local, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
              )
              .run(r.id, r.name, r.username, r.password, r.url, r.notes, r.is_env, r.custom_fields, r.item_type, r.created_at, r.updated_at);
            total++;
          }
          sourceDb.prepare('DELETE FROM vault').run();
        } catch {}

        // TOTP
        try {
          const rows = sourceDb.prepare('SELECT * FROM totp').all() as any[];
          for (const r of rows) {
            targetDb
              .prepare('INSERT OR IGNORE INTO totp (id, name, secret, issuer, account, is_local, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
              .run(r.id, r.name, r.secret, r.issuer, r.account, r.created_at);
            total++;
          }
          sourceDb.prepare('DELETE FROM totp').run();
        } catch {}
      }

      sourceDb.close();
    } catch {}
  }

  // Fallback JSON migration
  const sourceFallback = path.join(sourceDir, 'local-store.json');
  const targetFallback = path.join(targetDir, 'local-store.json');
  if (fs.existsSync(sourceFallback)) {
    try {
      const sourceData = JSON.parse(fs.readFileSync(sourceFallback, 'utf-8'));
      let targetData: any = { ideas: [], goals: [], events: [], forms: [], flows: [], vault: [], totp: [], tags: [], trash: [] };
      if (fs.existsSync(targetFallback)) {
        try {
          targetData = JSON.parse(fs.readFileSync(targetFallback, 'utf-8'));
        } catch {}
      }

      for (const key of Object.keys(sourceData)) {
        if (Array.isArray(sourceData[key])) {
          targetData[key] = targetData[key] || [];
          const existingIds = new Set(targetData[key].map((x: any) => x.id));
          for (const item of sourceData[key]) {
            if (!existingIds.has(item.id)) {
              targetData[key].push({ ...item, isLocal: true });
              total++;
            }
          }
        }
      }

      fs.writeFileSync(targetFallback, JSON.stringify(targetData, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.writeFileSync(sourceFallback, JSON.stringify({ ideas: [], goals: [] }, null, 2), { encoding: 'utf-8', mode: 0o600 });
    } catch {}
  }

  return { total, ideas, goals, events, forms, flows };
}

/**
 * Executes cloud sync for all local items in the active account.
 */
export async function pushLocalItemsToCloud(opts: { url?: string; token?: string; workspace?: string } = {}) {
  const client = getClient(opts);
  const DatabaseSync = getNativeSqlite();
  const db = DatabaseSync ? getDatabase() : null;

  let pushedIdeas = 0;
  let pushedGoals = 0;

  if (db) {
    // Push ideas
    try {
      const ideas = db.prepare('SELECT * FROM ideas WHERE is_local = 1').all() as any[];
      for (const item of ideas) {
        const tags = item.tags ? JSON.parse(item.tags) : [];
        if (item.category) tags.push(`category:${item.category}`);
        await client.ideas.create({
          title: item.title,
          content: item.content,
          tags: tags.length > 0 ? tags : undefined,
          workspaceId: opts.workspace,
        });
        db.prepare('UPDATE ideas SET is_local = 0 WHERE id = ?').run(item.id);
        pushedIdeas++;
      }
    } catch {}

    // Push goals
    try {
      const goals = db.prepare('SELECT * FROM goals WHERE is_local = 1').all() as any[];
      for (const item of goals) {
        await client.goals.create({
          title: item.title,
          description: item.description,
          status: item.status || 'not_started',
          workspaceId: opts.workspace,
        });
        db.prepare('UPDATE goals SET is_local = 0 WHERE id = ?').run(item.id);
        pushedGoals++;
      }
    } catch {}
  }

  return { pushedIdeas, pushedGoals };
}

/**
 * Handles automatic offline data synchronization when a user logs in:
 * 1. Checks eligibility.
 * 2. If eligible, migrates offline items and pushes to cloud.
 * 3. If ineligible with warnings (e.g. multiple containers, custom partition), saves pending warning.
 */
export async function handlePostLoginAutoSync(serverUrl: string, userId: string, token?: string) {
  const verdict = evaluateOfflineAutoSync(serverUrl, userId);

  if (verdict.canAutoSync && verdict.sourceContainer && verdict.itemCount > 0) {
    try {
      console.log();
      console.log(
        pc.cyan(`📦 Found ${verdict.itemCount} offline items in container "${verdict.sourceContainer}". Syncing to your account...`)
      );

      const migrated = migrateOfflineData(verdict.sourceContainer, userId, 'default');
      const pushed = await pushLocalItemsToCloud({ url: serverUrl, token });

      printSuccess(
        `Successfully synced ${migrated.total} offline local items (${pushed.pushedIdeas} ideas, ${pushed.pushedGoals} goals) to your cloud account.`
      );

      // Clear any previous pending warning
      const config = loadConfig();
      if (config.pendingWarning) {
        delete config.pendingWarning;
        saveMasterConfig(config);
      }
    } catch (err: any) {
      console.warn(pc.yellow(`⚠ Note: Automatic offline sync could not complete: ${err.message}`));
      console.log(pc.dim(`Run \`kylrix accounts sync-offline ${verdict.sourceContainer}\` to retry.`));
    }
  } else if (!verdict.canAutoSync && verdict.reason) {
    const config = loadConfig();
    config.pendingWarning = verdict.reason;
    saveMasterConfig(config);

    console.log();
    console.log(pc.yellow(`⚠ Warning: ${verdict.reason}`));
    console.log(pc.dim('Run `kylrix accounts sync-source` or `kylrix accounts sync-offline` to resolve.\n'));
  }
}
