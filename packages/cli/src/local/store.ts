import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDatabase, generateLocalId } from './sqlite';
import { resolveEnvironment } from '../config';

function loadFallback(): any {
  try {
    const env = resolveEnvironment();
    const fallbackPath = env.siloFallbackPath;
    if (!fs.existsSync(fallbackPath)) {
      return { ideas: [], goals: [], events: [], forms: [], flows: [], vault: [], totp: [], tags: [], trash: [] };
    }
    return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
  } catch {
    return { ideas: [], goals: [], events: [], forms: [], flows: [], vault: [], totp: [], tags: [], trash: [] };
  }
}

function saveFallback(data: any): void {
  try {
    const env = resolveEnvironment();
    const fallbackPath = env.siloFallbackPath;
    const dir = path.dirname(fallbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch {}
}

export const LocalStore = {
  // ── Ideas ──
  listIdeas(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare('SELECT * FROM ideas ORDER BY updated_at DESC');
      const rows = stmt.all().map((r: any) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        tags: r.tags ? JSON.parse(r.tags) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.ideas || [], count: store.ideas?.length || 0 };
  },

  getIdea(id: string): any {
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare('SELECT * FROM ideas WHERE id = ? OR cloud_id = ?');
      const r = stmt.get(id, id) as any;
      if (!r) throw new Error(`Idea not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        tags: r.tags ? JSON.parse(r.tags) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    const store = loadFallback();
    const item = store.ideas.find((i: any) => i.id === id || i.cloudId === id);
    if (!item) throw new Error(`Idea not found: ${id}`);
    return item;
  },

  createIdea(data: { id?: string; title: string; content?: string; category?: string; tags?: string[]; syncStatus?: string; cloudId?: string }): any {
    const id = data.id || generateLocalId('idea');
    const now = new Date().toISOString();
    const syncStatus = data.syncStatus || 'unsynced';
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO ideas (id, title, content, category, tags, is_local, sync_status, cloud_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);
      stmt.run(id, data.title, data.content || '', data.category || 'general', JSON.stringify(data.tags || []), syncStatus, cloudId, now, now);
      return {
        id,
        title: data.title,
        content: data.content || '',
        category: data.category || 'general',
        tags: data.tags || [],
        isLocal: true,
        syncStatus,
        cloudId,
        createdAt: now,
        updatedAt: now,
      };
    }
    const store = loadFallback();
    const item = { id, title: data.title, content: data.content || '', category: data.category || 'general', tags: data.tags || [], isLocal: true, syncStatus, cloudId, createdAt: now, updatedAt: now };
    store.ideas.unshift(item);
    saveFallback(store);
    return item;
  },

  upsertIdeaFromCloud(item: { id: string; title: string; content?: string; category?: string; tags?: string[]; createdAt?: string; updatedAt?: string }): any {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = item.createdAt || now;
    const updatedAt = item.updatedAt || now;
    const tagsJson = JSON.stringify(item.tags || []);
    if (db) {
      const existing = db.prepare('SELECT id FROM ideas WHERE id = ? OR cloud_id = ?').get(item.id, item.id) as any;
      if (existing) {
        db.prepare(`
          UPDATE ideas SET title = ?, content = ?, category = ?, tags = ?, sync_status = 'synced', cloud_id = ?, updated_at = ?
          WHERE id = ?
        `).run(item.title, item.content || '', item.category || 'general', tagsJson, item.id, updatedAt, existing.id);
        return { id: existing.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO ideas (id, title, content, category, tags, is_local, sync_status, cloud_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, 'synced', ?, ?, ?)
        `).run(item.id, item.title, item.content || '', item.category || 'general', tagsJson, item.id, createdAt, updatedAt);
        return { id: item.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i: any) => i.id === item.id || i.cloudId === item.id);
    const enriched = { ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.ideas[idx] = { ...store.ideas[idx], ...enriched };
    } else {
      store.ideas.unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },

  markIdeaSynced(localId: string, cloudId: string): void {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE ideas SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = store.ideas?.find((i: any) => i.id === localId);
    if (item) {
      item.syncStatus = 'synced';
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },

  updateIdea(id: string, updates: any): any {
    const now = new Date().toISOString();
    const existing = this.getIdea(id);
    const updated = { ...existing, ...updates, updatedAt: now };
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare(`
        UPDATE ideas SET title = ?, content = ?, category = ?, tags = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(updated.title, updated.content || '', updated.category || 'general', JSON.stringify(updated.tags || []), now, id);
      return updated;
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      store.ideas[idx] = updated;
      saveFallback(store);
    }
    return updated;
  },

  deleteIdea(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare('SELECT * FROM ideas WHERE id = ? OR cloud_id = ?').get(id, id) as any;
      if (existing) {
        db.prepare('DELETE FROM ideas WHERE id = ?').run(existing.id);
        db.prepare('INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)').run(
          existing.id,
          'idea',
          existing.title,
          new Date().toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.ideas.findIndex((i: any) => i.id === id || i.cloudId === id);
    if (idx !== -1) {
      const [deleted] = store.ideas.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'idea', title: deleted.title, deletedAt: new Date().toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Goals ──
  listGoals(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare('SELECT * FROM goals ORDER BY updated_at DESC');
      const rows = stmt.all().map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        targetValue: r.target_value,
        currentValue: r.current_value,
        unit: r.unit,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.goals || [], count: store.goals?.length || 0 };
  },

  getGoal(id: string): any {
    const db = getDatabase();
    if (db) {
      const r = db.prepare('SELECT * FROM goals WHERE id = ? OR cloud_id = ?').get(id, id) as any;
      if (!r) throw new Error(`Goal not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        targetValue: r.target_value,
        currentValue: r.current_value,
        unit: r.unit,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    const store = loadFallback();
    const item = store.goals.find((g: any) => g.id === id || g.cloudId === id);
    if (!item) throw new Error(`Goal not found: ${id}`);
    return item;
  },

  createGoal(data: any): any {
    const id = data.id || generateLocalId('goal');
    const now = new Date().toISOString();
    const syncStatus = data.syncStatus || 'unsynced';
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO goals (id, title, description, target_value, current_value, unit, status, is_local, sync_status, cloud_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        data.title,
        data.description || '',
        data.targetValue ?? 100,
        data.currentValue ?? 0,
        data.unit || '%',
        data.status || 'not_started',
        syncStatus,
        cloudId,
        now,
        now
      );
      return {
        id,
        title: data.title,
        description: data.description || '',
        targetValue: data.targetValue ?? 100,
        currentValue: data.currentValue ?? 0,
        unit: data.unit || '%',
        status: data.status || 'not_started',
        isLocal: true,
        syncStatus,
        cloudId,
        createdAt: now,
        updatedAt: now,
      };
    }
    const store = loadFallback();
    const item = { id, title: data.title, description: data.description || '', targetValue: data.targetValue ?? 100, currentValue: data.currentValue ?? 0, unit: data.unit || '%', status: data.status || 'not_started', isLocal: true, syncStatus, cloudId, createdAt: now, updatedAt: now };
    store.goals.unshift(item);
    saveFallback(store);
    return item;
  },

  upsertGoalFromCloud(item: any): any {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = item.createdAt || now;
    const updatedAt = item.updatedAt || now;
    if (db) {
      const existing = db.prepare('SELECT id FROM goals WHERE id = ? OR cloud_id = ?').get(item.id, item.id) as any;
      if (existing) {
        db.prepare(`
          UPDATE goals SET title = ?, description = ?, target_value = ?, current_value = ?, unit = ?, status = ?, sync_status = 'synced', cloud_id = ?, updated_at = ?
          WHERE id = ?
        `).run(
          item.title,
          item.description || '',
          item.targetValue ?? 100,
          item.currentValue ?? 0,
          item.unit || '%',
          item.status || 'not_started',
          item.id,
          updatedAt,
          existing.id
        );
        return { id: existing.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO goals (id, title, description, target_value, current_value, unit, status, is_local, sync_status, cloud_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'synced', ?, ?, ?)
        `).run(
          item.id,
          item.title,
          item.description || '',
          item.targetValue ?? 100,
          item.currentValue ?? 0,
          item.unit || '%',
          item.status || 'not_started',
          item.id,
          createdAt,
          updatedAt
        );
        return { id: item.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g: any) => g.id === item.id || g.cloudId === item.id);
    const enriched = { ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.goals[idx] = { ...store.goals[idx], ...enriched };
    } else {
      store.goals.unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },

  markGoalSynced(localId: string, cloudId: string): void {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE goals SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = store.goals?.find((g: any) => g.id === localId);
    if (item) {
      item.syncStatus = 'synced';
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },

  updateGoal(id: string, updates: any): any {
    const now = new Date().toISOString();
    const existing = this.getGoal(id);
    const updated = { ...existing, ...updates, updatedAt: now };
    const db = getDatabase();
    if (db) {
      db.prepare(`
        UPDATE goals SET title = ?, description = ?, target_value = ?, current_value = ?, unit = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.title,
        updated.description || '',
        updated.targetValue ?? 100,
        updated.currentValue ?? 0,
        updated.unit || '%',
        updated.status || 'not_started',
        now,
        id
      );
      return updated;
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g: any) => g.id === id);
    if (idx !== -1) {
      store.goals[idx] = updated;
      saveFallback(store);
    }
    return updated;
  },

  deleteGoal(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare('SELECT * FROM goals WHERE id = ? OR cloud_id = ?').get(id, id) as any;
      if (existing) {
        db.prepare('DELETE FROM goals WHERE id = ?').run(existing.id);
        db.prepare('INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)').run(
          existing.id,
          'goal',
          existing.title,
          new Date().toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.goals.findIndex((g: any) => g.id === id || g.cloudId === id);
    if (idx !== -1) {
      const [deleted] = store.goals.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'goal', title: deleted.title, deletedAt: new Date().toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Vault ──
  listVault(): any[] {
    const db = getDatabase();
    if (db) {
      return db.prepare('SELECT * FROM vault ORDER BY updated_at DESC').all().map((r: any) => ({
        id: r.id,
        name: r.name,
        username: r.username,
        password: r.password,
        url: r.url,
        notes: r.notes,
        isEnv: Boolean(r.is_env),
        customFields: r.custom_fields ? (r.custom_fields.startsWith('{') || r.custom_fields.startsWith('[') ? JSON.parse(r.custom_fields) : r.custom_fields) : undefined,
        itemType: r.item_type,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }
    return loadFallback().vault || [];
  },

  getVault(id: string): any {
    const db = getDatabase();
    if (db) {
      const r = db.prepare('SELECT * FROM vault WHERE id = ?').get(id) as any;
      if (!r) throw new Error(`Secret not found: ${id}`);
      return {
        id: r.id,
        name: r.name,
        username: r.username,
        password: r.password,
        url: r.url,
        notes: r.notes,
        isEnv: Boolean(r.is_env),
        customFields: r.custom_fields ? (r.custom_fields.startsWith('{') || r.custom_fields.startsWith('[') ? JSON.parse(r.custom_fields) : r.custom_fields) : undefined,
        itemType: r.item_type,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    const item = (loadFallback().vault || []).find((v: any) => v.id === id);
    if (!item) throw new Error(`Secret not found: ${id}`);
    return item;
  },

  createVault(data: any): any {
    const id = generateLocalId('sec');
    const now = new Date().toISOString();
    const customFieldsStr = typeof data.customFields === 'object' ? JSON.stringify(data.customFields) : data.customFields || '';
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO vault (id, name, username, password, url, notes, is_env, custom_fields, item_type, is_local, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        data.name,
        data.username || '',
        data.password || '',
        data.url || '',
        data.notes || '',
        data.isEnv ? 1 : 0,
        customFieldsStr,
        data.itemType || (data.isEnv ? 'env' : 'login'),
        now,
        now
      );
      return { id, ...data, isLocal: true, createdAt: now, updatedAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, createdAt: now, updatedAt: now };
    store.vault.unshift(item);
    saveFallback(store);
    return item;
  },

  deleteVault(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      const existing = db.prepare('SELECT * FROM vault WHERE id = ?').get(id) as any;
      if (existing) {
        db.prepare('DELETE FROM vault WHERE id = ?').run(id);
        db.prepare('INSERT INTO trash (id, kind, title, deleted_at) VALUES (?, ?, ?, ?)').run(
          existing.id,
          'vault',
          existing.name,
          new Date().toISOString()
        );
      }
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.vault.findIndex((v: any) => v.id === id);
    if (idx !== -1) {
      const [deleted] = store.vault.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'vault', title: deleted.name, deletedAt: new Date().toISOString() });
      saveFallback(store);
    }
    return { success: true };
  },

  // ── TOTP ──
  listTotp(): any[] {
    const db = getDatabase();
    if (db) {
      return db.prepare('SELECT * FROM totp ORDER BY created_at DESC').all().map((r: any) => ({
        id: r.id,
        name: r.name,
        secret: r.secret,
        issuer: r.issuer,
        account: r.account,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
      }));
    }
    return loadFallback().totp || [];
  },

  getTotp(id: string): any {
    const db = getDatabase();
    if (db) {
      const r = db.prepare('SELECT * FROM totp WHERE id = ?').get(id) as any;
      if (!r) throw new Error(`TOTP entry not found: ${id}`);
      return {
        id: r.id,
        name: r.name,
        secret: r.secret,
        issuer: r.issuer,
        account: r.account,
        isLocal: Boolean(r.is_local),
        createdAt: r.created_at,
      };
    }
    const item = (loadFallback().totp || []).find((t: any) => t.id === id);
    if (!item) throw new Error(`TOTP entry not found: ${id}`);
    return item;
  },

  createTotp(data: any): any {
    const id = generateLocalId('totp');
    const now = new Date().toISOString();
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO totp (id, name, secret, issuer, account, is_local, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(id, data.name, data.secret, data.issuer || '', data.account || '', now);
      return { id, ...data, isLocal: true, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, createdAt: now };
    store.totp.unshift(item);
    saveFallback(store);
    return item;
  },

  deleteTotp(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM totp WHERE id = ?').run(id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.totp.findIndex((t: any) => t.id === id);
    if (idx !== -1) {
      store.totp.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Events ──
  listEvents(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare('SELECT * FROM events ORDER BY start_time ASC').all().map((r: any) => ({
        id: r.id,
        title: r.title,
        startTime: r.start_time,
        endTime: r.end_time,
        description: r.description,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.events || [], count: store.events?.length || 0 };
  },

  getEvent(id: string): any {
    const db = getDatabase();
    if (db) {
      const stmt = db.prepare('SELECT * FROM events WHERE id = ? OR cloud_id = ?');
      const r = stmt.get(id, id) as any;
      if (!r) throw new Error(`Event not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        startTime: r.start_time,
        endTime: r.end_time,
        description: r.description,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      };
    }
    const store = loadFallback();
    const item = (store.events || []).find((e: any) => e.id === id || e.cloudId === id);
    if (!item) throw new Error(`Event not found: ${id}`);
    return item;
  },

  createEvent(data: any): any {
    const id = data.id || generateLocalId('evt');
    const now = new Date().toISOString();
    const syncStatus = data.syncStatus || 'unsynced';
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO events (id, title, start_time, end_time, description, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.startTime, data.endTime, data.description || '', syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.events.unshift(item);
    saveFallback(store);
    return item;
  },

  upsertEventFromCloud(item: any): any {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = item.createdAt || now;
    if (db) {
      const existing = db.prepare('SELECT id FROM events WHERE id = ? OR cloud_id = ?').get(item.id, item.id) as any;
      if (existing) {
        db.prepare(`
          UPDATE events SET title = ?, start_time = ?, end_time = ?, description = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.startTime || '', item.endTime || '', item.description || '', item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO events (id, title, start_time, end_time, description, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.startTime || '', item.endTime || '', item.description || '', item.id, createdAt);
        return { id: item.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.events || []).findIndex((e: any) => e.id === item.id || e.cloudId === item.id);
    const enriched = { ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.events[idx] = { ...store.events[idx], ...enriched };
    } else {
      (store.events = store.events || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },

  markEventSynced(localId: string, cloudId: string): void {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE events SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.events || []).find((e: any) => e.id === localId);
    if (item) {
      item.syncStatus = 'synced';
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },

  deleteEvent(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM events WHERE id = ? OR cloud_id = ?').run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.events.findIndex((e: any) => e.id === id || e.cloudId === id);
    if (idx !== -1) {
      store.events.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Forms ──
  listForms(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare('SELECT * FROM forms ORDER BY created_at DESC').all().map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        schema: r.schema ? JSON.parse(r.schema) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.forms || [], count: store.forms?.length || 0 };
  },

  getForm(id: string): any {
    const db = getDatabase();
    if (db) {
      const r = db.prepare('SELECT * FROM forms WHERE id = ? OR cloud_id = ?').get(id, id) as any;
      if (!r) throw new Error(`Form not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        schema: r.schema ? JSON.parse(r.schema) : [],
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      };
    }
    const item = (loadFallback().forms || []).find((f: any) => f.id === id || f.cloudId === id);
    if (!item) throw new Error(`Form not found: ${id}`);
    return item;
  },

  createForm(data: any): any {
    const id = data.id || generateLocalId('form');
    const now = new Date().toISOString();
    const syncStatus = data.syncStatus || 'unsynced';
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO forms (id, title, description, schema, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.description || '', JSON.stringify(data.schema || []), syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.forms.unshift(item);
    saveFallback(store);
    return item;
  },

  upsertFormFromCloud(item: any): any {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = item.createdAt || now;
    const schemaJson = JSON.stringify(item.schema || []);
    if (db) {
      const existing = db.prepare('SELECT id FROM forms WHERE id = ? OR cloud_id = ?').get(item.id, item.id) as any;
      if (existing) {
        db.prepare(`
          UPDATE forms SET title = ?, description = ?, schema = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.description || '', schemaJson, item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO forms (id, title, description, schema, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.description || '', schemaJson, item.id, createdAt);
        return { id: item.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.forms || []).findIndex((f: any) => f.id === item.id || f.cloudId === item.id);
    const enriched = { ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.forms[idx] = { ...store.forms[idx], ...enriched };
    } else {
      (store.forms = store.forms || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },

  markFormSynced(localId: string, cloudId: string): void {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE forms SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.forms || []).find((f: any) => f.id === localId);
    if (item) {
      item.syncStatus = 'synced';
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },

  deleteForm(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM forms WHERE id = ? OR cloud_id = ?').run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.forms.findIndex((f: any) => f.id === id || f.cloudId === id);
    if (idx !== -1) {
      store.forms.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Flows ──
  listFlows(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all().map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.flows || [], count: store.flows?.length || 0 };
  },

  getFlow(id: string): any {
    const db = getDatabase();
    if (db) {
      const r = db.prepare('SELECT * FROM flows WHERE id = ? OR cloud_id = ?').get(id, id) as any;
      if (!r) throw new Error(`Flow not found: ${id}`);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        isLocal: Boolean(r.is_local),
        syncStatus: r.sync_status || (r.cloud_id ? 'synced' : 'unsynced'),
        cloudId: r.cloud_id || null,
        createdAt: r.created_at,
      };
    }
    const item = (loadFallback().flows || []).find((f: any) => f.id === id || f.cloudId === id);
    if (!item) throw new Error(`Flow not found: ${id}`);
    return item;
  },

  createFlow(data: any): any {
    const id = data.id || generateLocalId('flow');
    const now = new Date().toISOString();
    const syncStatus = data.syncStatus || 'unsynced';
    const cloudId = data.cloudId || null;
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO flows (id, title, description, status, is_local, sync_status, cloud_id, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.title, data.description || '', data.status || 'draft', syncStatus, cloudId, now);
      return { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true, syncStatus, cloudId, createdAt: now };
    store.flows.unshift(item);
    saveFallback(store);
    return item;
  },

  upsertFlowFromCloud(item: any): any {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = item.createdAt || now;
    if (db) {
      const existing = db.prepare('SELECT id FROM flows WHERE id = ? OR cloud_id = ?').get(item.id, item.id) as any;
      if (existing) {
        db.prepare(`
          UPDATE flows SET title = ?, description = ?, status = ?, sync_status = 'synced', cloud_id = ?
          WHERE id = ?
        `).run(item.title, item.description || '', item.status || 'draft', item.id, existing.id);
        return { id: existing.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      } else {
        db.prepare(`
          INSERT INTO flows (id, title, description, status, is_local, sync_status, cloud_id, created_at)
          VALUES (?, ?, ?, ?, 1, 'synced', ?, ?)
        `).run(item.id, item.title, item.description || '', item.status || 'draft', item.id, createdAt);
        return { id: item.id, ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
      }
    }
    const store = loadFallback();
    const idx = (store.flows || []).findIndex((f: any) => f.id === item.id || f.cloudId === item.id);
    const enriched = { ...item, syncStatus: 'synced', cloudId: item.id, isLocal: true };
    if (idx !== -1) {
      store.flows[idx] = { ...store.flows[idx], ...enriched };
    } else {
      (store.flows = store.flows || []).unshift(enriched);
    }
    saveFallback(store);
    return enriched;
  },

  markFlowSynced(localId: string, cloudId: string): void {
    const db = getDatabase();
    if (db) {
      db.prepare(`UPDATE flows SET sync_status = 'synced', cloud_id = ? WHERE id = ?`).run(cloudId, localId);
    }
    const store = loadFallback();
    const item = (store.flows || []).find((fl: any) => fl.id === localId);
    if (item) {
      item.syncStatus = 'synced';
      item.cloudId = cloudId;
      saveFallback(store);
    }
  },

  deleteFlow(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM flows WHERE id = ? OR cloud_id = ?').run(id, id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.flows.findIndex((f: any) => f.id === id || f.cloudId === id);
    if (idx !== -1) {
      store.flows.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Tags ──
  listTags(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare('SELECT * FROM tags').all().map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        isLocal: Boolean(r.is_local),
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.tags || [], count: store.tags?.length || 0 };
  },

  createTag(data: any): any {
    const id = generateLocalId('tag');
    const db = getDatabase();
    if (db) {
      db.prepare(`
        INSERT INTO tags (id, name, color, is_local)
        VALUES (?, ?, ?, 1)
      `).run(id, data.name, data.color || '#6366F1');
      return { id, ...data, isLocal: true };
    }
    const store = loadFallback();
    const item = { id, ...data, isLocal: true };
    store.tags.unshift(item);
    saveFallback(store);
    return item;
  },

  deleteTag(id: string): { success: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM tags WHERE id = ?').run(id);
      return { success: true };
    }
    const store = loadFallback();
    const idx = store.tags.findIndex((t: any) => t.id === id);
    if (idx !== -1) {
      store.tags.splice(idx, 1);
      saveFallback(store);
    }
    return { success: true };
  },

  // ── Trash ──
  listTrash(): { items: any[]; count: number } {
    const db = getDatabase();
    if (db) {
      const rows = db.prepare('SELECT * FROM trash ORDER BY deleted_at DESC').all().map((r: any) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        deletedAt: r.deleted_at,
      }));
      return { items: rows, count: rows.length };
    }
    const store = loadFallback();
    return { items: store.trash || [], count: store.trash?.length || 0 };
  },

  restoreTrash(kind: string, id: string): { restored: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM trash WHERE id = ? AND kind = ?').run(id, kind);
      return { restored: true };
    }
    const store = loadFallback();
    const idx = store.trash.findIndex((t: any) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveFallback(store);
    }
    return { restored: true };
  },

  purgeTrash(kind: string, id: string): { purged: boolean } {
    const db = getDatabase();
    if (db) {
      db.prepare('DELETE FROM trash WHERE id = ? AND kind = ?').run(id, kind);
      return { purged: true };
    }
    const store = loadFallback();
    const idx = store.trash.findIndex((t: any) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveFallback(store);
    }
    return { purged: true };
  },

  // ── High Performance SQLite Full-Text / LIKE Search ──
  search(query: string): any[] {
    const q = `%${query.toLowerCase().trim()}%`;
    const db = getDatabase();
    if (db) {
      const results: any[] = [];
      try {
        const ideas = db.prepare('SELECT id, title, content, sync_status, cloud_id, is_local FROM ideas WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?').all(q, q) as any[];
        for (const i of ideas) {
          results.push({
            kind: 'idea',
            id: i.id,
            title: i.title,
            snippet: i.content?.substring(0, 100),
            syncStatus: i.sync_status || (i.cloud_id ? 'synced' : 'unsynced'),
            cloudId: i.cloud_id || null,
            isLocal: Boolean(i.is_local),
          });
        }
      } catch {}

      try {
        const goals = db.prepare('SELECT id, title, description, sync_status, cloud_id, is_local FROM goals WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?').all(q, q) as any[];
        for (const g of goals) {
          results.push({
            kind: 'goal',
            id: g.id,
            title: g.title,
            snippet: g.description?.substring(0, 100),
            syncStatus: g.sync_status || (g.cloud_id ? 'synced' : 'unsynced'),
            cloudId: g.cloud_id || null,
            isLocal: Boolean(g.is_local),
          });
        }
      } catch {}

      try {
        const secrets = db.prepare('SELECT id, name, sync_status, cloud_id, is_local FROM vault WHERE LOWER(name) LIKE ? OR LOWER(username) LIKE ?').all(q, q) as any[];
        for (const s of secrets) {
          results.push({
            kind: 'vault',
            id: s.id,
            title: s.name,
            syncStatus: s.sync_status || (s.cloud_id ? 'synced' : 'unsynced'),
            cloudId: s.cloud_id || null,
            isLocal: Boolean(s.is_local),
          });
        }
      } catch {}

      try {
        const events = db.prepare('SELECT id, title, description, sync_status, cloud_id, is_local FROM events WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?').all(q, q) as any[];
        for (const e of events) {
          results.push({
            kind: 'event',
            id: e.id,
            title: e.title,
            snippet: e.description?.substring(0, 100),
            syncStatus: e.sync_status || (e.cloud_id ? 'synced' : 'unsynced'),
            cloudId: e.cloud_id || null,
            isLocal: Boolean(e.is_local),
          });
        }
      } catch {}

      try {
        const forms = db.prepare('SELECT id, title, description, sync_status, cloud_id, is_local FROM forms WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?').all(q, q) as any[];
        for (const f of forms) {
          results.push({
            kind: 'form',
            id: f.id,
            title: f.title,
            snippet: f.description?.substring(0, 100),
            syncStatus: f.sync_status || (f.cloud_id ? 'synced' : 'unsynced'),
            cloudId: f.cloud_id || null,
            isLocal: Boolean(f.is_local),
          });
        }
      } catch {}

      try {
        const flows = db.prepare('SELECT id, title, description, sync_status, cloud_id, is_local FROM flows WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?').all(q, q) as any[];
        for (const fl of flows) {
          results.push({
            kind: 'flow',
            id: fl.id,
            title: fl.title,
            snippet: fl.description?.substring(0, 100),
            syncStatus: fl.sync_status || (fl.cloud_id ? 'synced' : 'unsynced'),
            cloudId: fl.cloud_id || null,
            isLocal: Boolean(fl.is_local),
          });
        }
      } catch {}

      return results;
    }

    const store = loadFallback();
    const results: any[] = [];
    const plainQ = query.toLowerCase().trim();
    for (const i of store.ideas || []) {
      if (i.title?.toLowerCase().includes(plainQ) || i.content?.toLowerCase().includes(plainQ)) {
        results.push({
          kind: 'idea',
          id: i.id,
          title: i.title,
          snippet: i.content?.substring(0, 100),
          syncStatus: i.syncStatus || 'unsynced',
          cloudId: i.cloudId || null,
          isLocal: true,
        });
      }
    }
    for (const g of store.goals || []) {
      if (g.title?.toLowerCase().includes(plainQ) || g.description?.toLowerCase().includes(plainQ)) {
        results.push({
          kind: 'goal',
          id: g.id,
          title: g.title,
          snippet: g.description?.substring(0, 100),
          syncStatus: g.syncStatus || 'unsynced',
          cloudId: g.cloudId || null,
          isLocal: true,
        });
      }
    }
    return results;
  },
};
