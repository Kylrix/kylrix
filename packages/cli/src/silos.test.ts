import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import {
  normalizeBaseUrl,
  getBaseUriPartitionKey,
  getSiloDir,
  getSiloDbPath,
  getAccountSlug,
  saveConfig,
  loadConfig,
  saveMasterConfig,
  switchAccount,
  listAccounts,
  removeAccount,
  switchServer,
  listServers,
  resolveEnvironment,
  clearConfig,
  DEFAULT_API_URL,
  DEFAULT_OFFLINE_ACCOUNT,
} from './config';
import { evaluateOfflineAutoSync, listOfflineContainers, extractItems } from './local/sync-resolver';
import { LocalStore } from './local/store';
import { toListResult } from '@/sdk/api/client';

describe('CLI Base URI Partitioning and Multi-Account Silos', () => {
  beforeEach(() => {
    clearConfig();
  });

  afterEach(() => {
    clearConfig();
  });

  describe('normalizeBaseUrl', () => {
    it('normalizes undefined or empty to default API URL', () => {
      expect(normalizeBaseUrl()).toBe(DEFAULT_API_URL);
      expect(normalizeBaseUrl('')).toBe(DEFAULT_API_URL);
    });

    it('strips trailing slashes and api prefixes', () => {
      expect(normalizeBaseUrl('http://localhost:3005/')).toBe('http://localhost:3005');
      expect(normalizeBaseUrl('http://localhost:3005/api/v1')).toBe('http://localhost:3005');
      expect(normalizeBaseUrl('http://localhost:3005/api/')).toBe('http://localhost:3005');
      expect(normalizeBaseUrl('https://www.kylrix.space/api/v1')).toBe('https://www.kylrix.space');
    });

    it('prepends https if protocol is missing', () => {
      expect(normalizeBaseUrl('kylrix.space')).toBe('https://kylrix.space');
    });
  });

  describe('getBaseUriPartitionKey', () => {
    it('maps default cloud URL to "default"', () => {
      expect(getBaseUriPartitionKey('https://www.kylrix.space')).toBe('default');
      expect(getBaseUriPartitionKey('https://kylrix.space')).toBe('default');
    });

    it('creates safe filesystem slugs for custom servers and ports', () => {
      expect(getBaseUriPartitionKey('http://localhost:3005')).toBe('http_localhost_3005');
      expect(getBaseUriPartitionKey('https://selfhost.internal:8443')).toBe('https_selfhost_internal_8443');
    });
  });

  describe('Silo Path Resolution', () => {
    it('resolves partitioned silo directories correctly', () => {
      const defaultSilo = getSiloDir('https://www.kylrix.space', 'usr_alpha');
      expect(defaultSilo).toContain(path.join('silos', 'default', 'usr_alpha'));

      const customSilo = getSiloDir('http://localhost:3005', 'usr_beta');
      expect(customSilo).toContain(path.join('silos', 'http_localhost_3005', 'usr_beta'));
    });

    it('resolves database paths inside the respective silos', () => {
      const dbPath = getSiloDbPath('http://localhost:3005', 'usr_beta');
      expect(dbPath).toContain(path.join('silos', 'http_localhost_3005', 'usr_beta', 'local.db'));
    });
  });

  describe('Multi-Account Configuration per Base URI', () => {
    it('stores and switches multiple accounts under the same base URI', () => {
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'usr_1',
        email: 'user1@example.com',
        token: 'token_1',
        tier: 'FREE',
      });

      let env = resolveEnvironment();
      expect(env.userId).toBe('usr_1');
      expect(env.email).toBe('user1@example.com');
      expect(env.token).toBe('token_1');

      // Add second account to same base URI
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'usr_2',
        email: 'user2@example.com',
        token: 'token_2',
        tier: 'PRO',
      });

      env = resolveEnvironment();
      expect(env.userId).toBe('usr_2');
      expect(env.email).toBe('user2@example.com');

      const accounts = listAccounts('https://www.kylrix.space');
      expect(accounts.accounts.length).toBe(2);

      // Switch back to account 1 by email
      const switched = switchAccount('user1@example.com');
      expect(switched.userId).toBe('usr_1');

      env = resolveEnvironment();
      expect(env.userId).toBe('usr_1');
      expect(env.token).toBe('token_1');

      // Switch by user ID
      const switched2 = switchAccount('usr_2');
      expect(switched2.userId).toBe('usr_2');
    });

    it('isolates accounts across different base URIs', () => {
      // Cloud account
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'cloud_user',
        email: 'cloud@example.com',
        token: 'cloud_pat',
      });

      // Local self-hosted account
      saveConfig({
        apiUrl: 'http://localhost:3005',
        userId: 'local_admin',
        email: 'admin@localhost',
        token: 'local_pat',
      });

      // Default should now point to localhost:3005 because it was saved last
      let env = resolveEnvironment();
      expect(env.apiUrl).toBe('http://localhost:3005');
      expect(env.userId).toBe('local_admin');
      expect(env.partitionKey).toBe('http_localhost_3005');
      expect(env.siloDbPath).toContain('http_localhost_3005');

      // Resolve explicitly for cloud
      const cloudEnv = resolveEnvironment({ url: 'https://www.kylrix.space' });
      expect(cloudEnv.apiUrl).toBe('https://www.kylrix.space');
      expect(cloudEnv.userId).toBe('cloud_user');
      expect(cloudEnv.token).toBe('cloud_pat');
      expect(cloudEnv.partitionKey).toBe('default');

      // Switch active server
      switchServer('https://www.kylrix.space');
      env = resolveEnvironment();
      expect(env.apiUrl).toBe('https://www.kylrix.space');
      expect(env.userId).toBe('cloud_user');

      const servers = listServers();
      expect(servers.length).toBeGreaterThanOrEqual(2);
    });

    it('removes accounts and falls back cleanly', () => {
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'usr_a',
        email: 'a@example.com',
      });
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'usr_b',
        email: 'b@example.com',
      });

      expect(listAccounts('https://www.kylrix.space').accounts.length).toBe(2);

      removeAccount('usr_b', 'https://www.kylrix.space');
      const updated = listAccounts('https://www.kylrix.space');
      expect(updated.accounts.length).toBe(1);
      expect(updated.accounts[0].userId).toBe('usr_a');
      expect(updated.activeAccountId).toBe('usr_a');
    });
  });

  describe('Offline Container Auto-Sync & Multi-Account Safety', () => {
    it('defaults offline account slug to DEFAULT_OFFLINE_ACCOUNT (default)', () => {
      expect(getAccountSlug()).toBe(DEFAULT_OFFLINE_ACCOUNT);
      expect(getAccountSlug(undefined)).toBe('default');
      expect(getSiloDir('https://www.kylrix.space')).toContain(path.join('silos', 'default', 'default'));
    });

    it('allows switching the default sync point container via config', () => {
      const config = loadConfig();
      config.defaultSyncSource = 'work_container';
      saveMasterConfig(config);

      expect(getAccountSlug()).toBe('work_container');
      expect(getSiloDir('https://www.kylrix.space')).toContain(path.join('silos', 'default', 'work_container'));
    });

    it('blocks automatic sync if active server is on a custom partition', () => {
      saveConfig({
        apiUrl: 'http://localhost:3005',
        userId: 'dev_user',
      });

      const verdict = evaluateOfflineAutoSync('http://localhost:3005', 'dev_user');
      expect(verdict.canAutoSync).toBe(false);
      expect(verdict.reason).toContain('custom partition');
    });

    it('blocks automatic sync if partition already has multiple accounts (earmarked)', () => {
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'first_user',
      });
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'second_user',
      });

      const verdict = evaluateOfflineAutoSync('https://www.kylrix.space', 'third_user');
      expect(verdict.canAutoSync).toBe(false);
      expect(verdict.reason).toContain('already contains multiple accounts');
    });

    it('lists offline containers without leaking authenticated user accounts', () => {
      saveConfig({
        apiUrl: 'https://www.kylrix.space',
        userId: 'authenticated_user_99',
      });

      const containers = listOfflineContainers('default');
      const names = containers.map((c) => c.name);
      expect(names).toContain('default');
      expect(names).not.toContain('authenticated_user_99');
    });
  });

  describe('Local-First Store & Bidirectional Sync Resilience', () => {
    it('creates ideas locally with sync_status=unsynced and retains them', () => {
      const idea = LocalStore.createIdea({
        title: 'Local Test Idea',
        content: 'Offline first content',
        category: 'test',
      });

      expect(idea.id).toBeDefined();
      expect(idea.title).toBe('Local Test Idea');
      expect(idea.syncStatus).toBe('unsynced');
      expect(idea.isLocal).toBe(true);

      const list = LocalStore.listIdeas();
      const found = list.items.find((i: any) => i.id === idea.id);
      expect(found).toBeDefined();
      expect(found?.syncStatus).toBe('unsynced');
    });

    it('upserts cloud items into local store with sync_status=synced', () => {
      const cloudItem = {
        id: 'cloud_note_123',
        title: 'Cloud Synced Note',
        content: 'From remote server',
        category: 'general',
      };

      const upserted = LocalStore.upsertIdeaFromCloud(cloudItem);
      expect(upserted.id).toBe('cloud_note_123');
      expect(upserted.syncStatus).toBe('synced');
      expect(upserted.cloudId).toBe('cloud_note_123');

      const found = LocalStore.getIdea('cloud_note_123');
      expect(found).toBeDefined();
      expect(found.title).toBe('Cloud Synced Note');
      expect(found.syncStatus).toBe('synced');
    });

    it('searches across local store and returns syncStatus', () => {
      const created = LocalStore.createIdea({
        title: `Unique Searchable Keyword X7 ${Date.now()}`,
        content: 'Testing local search functionality',
      });

      const results = LocalStore.search(created.title);
      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r: any) => r.id === created.id);
      expect(match).toBeDefined();
      expect(match?.kind).toBe('idea');
      expect(match?.syncStatus).toBe('unsynced');
      expect(match?.isLocal).toBe(true);
    });

    it('extractItems extracts arrays from raw arrays, { items: [] }, and { data: [] }', () => {
      const rawArr = [{ id: '1', title: 'Note 1' }];
      expect(extractItems(rawArr)).toEqual(rawArr);

      const itemsObj = { items: [{ id: '2', title: 'Note 2' }], count: 1 };
      expect(extractItems(itemsObj)).toEqual(itemsObj.items);

      const dataObj = { data: [{ id: '3', title: 'Note 3' }], ok: true };
      expect(extractItems(dataObj)).toEqual(dataObj.data);

      expect(extractItems(null)).toEqual([]);
      expect(extractItems(undefined)).toEqual([]);
      expect(extractItems({})).toEqual([]);
    });

    it('toListResult creates dual array + object result supporting both .items and array methods', () => {
      const raw = [{ id: 'item_a', title: 'Alpha' }, { id: 'item_b', title: 'Beta' }];
      const res = toListResult(raw);

      // Array behavior
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(2);
      expect(res[0].id).toBe('item_a');
      expect(res.map((x: any) => x.id)).toEqual(['item_a', 'item_b']);

      // Object envelope behavior
      expect(res.items).toBeDefined();
      expect(res.items.length).toBe(2);
      expect(res.count).toBe(2);
      expect(res.items[1].id).toBe('item_b');

      // extractItems compatibility
      expect(extractItems(res)).toEqual(raw);
    });
  });
});


