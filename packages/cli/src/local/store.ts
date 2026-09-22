import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export interface LocalStoreData {
  ideas: any[];
  goals: any[];
  events: any[];
  forms: any[];
  flows: any[];
  vault: any[];
  totp: any[];
  tags: any[];
  trash: any[];
}

const LOCAL_DIR = path.join(os.homedir(), '.kylrix');
const LOCAL_FILE = path.join(LOCAL_DIR, 'local-store.json');

function getInitialStore(): LocalStoreData {
  return {
    ideas: [],
    goals: [],
    events: [],
    forms: [],
    flows: [],
    vault: [],
    totp: [],
    tags: [],
    trash: [],
  };
}

export function loadLocalStore(): LocalStoreData {
  try {
    if (!fs.existsSync(LOCAL_FILE)) {
      return getInitialStore();
    }
    const raw = fs.readFileSync(LOCAL_FILE, 'utf-8');
    return { ...getInitialStore(), ...JSON.parse(raw) };
  } catch {
    return getInitialStore();
  }
}

export function saveLocalStore(data: LocalStoreData): void {
  try {
    if (!fs.existsSync(LOCAL_DIR)) {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch (err: any) {
    throw new Error(`Failed to save local store: ${err.message}`);
  }
}

export function generateLocalId(prefix: string): string {
  return `loc_${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export const LocalStore = {
  // ── Ideas ──
  listIdeas() {
    const store = loadLocalStore();
    return { items: store.ideas, count: store.ideas.length };
  },
  getIdea(id: string) {
    const store = loadLocalStore();
    const item = store.ideas.find((i) => i.id === id);
    if (!item) throw new Error(`Idea not found: ${id}`);
    return item;
  },
  createIdea(data: { title: string; content?: string; category?: string; tags?: string[] }) {
    const store = loadLocalStore();
    const id = generateLocalId('idea');
    const now = new Date().toISOString();
    const item = {
      id,
      title: data.title,
      content: data.content || '',
      category: data.category || 'general',
      tags: data.tags || [],
      isLocal: true,
      createdAt: now,
      updatedAt: now,
    };
    store.ideas.unshift(item);
    saveLocalStore(store);
    return item;
  },
  updateIdea(id: string, updates: any) {
    const store = loadLocalStore();
    const idx = store.ideas.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error(`Idea not found: ${id}`);
    const item = { ...store.ideas[idx], ...updates, updatedAt: new Date().toISOString() };
    store.ideas[idx] = item;
    saveLocalStore(store);
    return item;
  },
  deleteIdea(id: string) {
    const store = loadLocalStore();
    const idx = store.ideas.findIndex((i) => i.id === id);
    if (idx !== -1) {
      const [deleted] = store.ideas.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'idea', title: deleted.title, deletedAt: new Date().toISOString() });
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Goals ──
  listGoals() {
    const store = loadLocalStore();
    return { items: store.goals, count: store.goals.length };
  },
  getGoal(id: string) {
    const store = loadLocalStore();
    const item = store.goals.find((g) => g.id === id);
    if (!item) throw new Error(`Goal not found: ${id}`);
    return item;
  },
  createGoal(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('goal');
    const now = new Date().toISOString();
    const item = {
      id,
      title: data.title,
      description: data.description || '',
      targetValue: data.targetValue ?? 100,
      currentValue: data.currentValue ?? 0,
      unit: data.unit || '%',
      status: data.status || 'not_started',
      isLocal: true,
      createdAt: now,
      updatedAt: now,
    };
    store.goals.unshift(item);
    saveLocalStore(store);
    return item;
  },
  updateGoal(id: string, updates: any) {
    const store = loadLocalStore();
    const idx = store.goals.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error(`Goal not found: ${id}`);
    const item = { ...store.goals[idx], ...updates, updatedAt: new Date().toISOString() };
    store.goals[idx] = item;
    saveLocalStore(store);
    return item;
  },
  deleteGoal(id: string) {
    const store = loadLocalStore();
    const idx = store.goals.findIndex((g) => g.id === id);
    if (idx !== -1) {
      const [deleted] = store.goals.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'goal', title: deleted.title, deletedAt: new Date().toISOString() });
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Vault ──
  listVault() {
    const store = loadLocalStore();
    return store.vault;
  },
  getVault(id: string) {
    const store = loadLocalStore();
    const item = store.vault.find((v) => v.id === id);
    if (!item) throw new Error(`Secret not found: ${id}`);
    return item;
  },
  createVault(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('sec');
    const now = new Date().toISOString();
    const item = {
      id,
      name: data.name,
      username: data.username,
      password: data.password,
      url: data.url,
      notes: data.notes,
      isEnv: Boolean(data.isEnv),
      customFields: data.customFields,
      itemType: data.itemType || (data.isEnv ? 'env' : 'login'),
      isLocal: true,
      createdAt: now,
      updatedAt: now,
    };
    store.vault.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteVault(id: string) {
    const store = loadLocalStore();
    const idx = store.vault.findIndex((v) => v.id === id);
    if (idx !== -1) {
      const [deleted] = store.vault.splice(idx, 1);
      store.trash.unshift({ id: deleted.id, kind: 'vault', title: deleted.name, deletedAt: new Date().toISOString() });
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── TOTP ──
  listTotp() {
    const store = loadLocalStore();
    return store.totp;
  },
  getTotp(id: string) {
    const store = loadLocalStore();
    const item = store.totp.find((t) => t.id === id);
    if (!item) throw new Error(`TOTP entry not found: ${id}`);
    return item;
  },
  createTotp(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('totp');
    const item = {
      id,
      name: data.name,
      secret: data.secret,
      issuer: data.issuer || '',
      account: data.account || '',
      isLocal: true,
      createdAt: new Date().toISOString(),
    };
    store.totp.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteTotp(id: string) {
    const store = loadLocalStore();
    const idx = store.totp.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.totp.splice(idx, 1);
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Events ──
  listEvents() {
    const store = loadLocalStore();
    return { items: store.events, count: store.events.length };
  },
  createEvent(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('evt');
    const item = {
      id,
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isLocal: true,
      createdAt: new Date().toISOString(),
    };
    store.events.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteEvent(id: string) {
    const store = loadLocalStore();
    const idx = store.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      store.events.splice(idx, 1);
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Forms ──
  listForms() {
    const store = loadLocalStore();
    return { items: store.forms, count: store.forms.length };
  },
  getForm(id: string) {
    const store = loadLocalStore();
    const item = store.forms.find((f) => f.id === id);
    if (!item) throw new Error(`Form not found: ${id}`);
    return item;
  },
  createForm(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('form');
    const item = {
      id,
      title: data.title,
      description: data.description || '',
      schema: data.schema || [],
      isLocal: true,
      createdAt: new Date().toISOString(),
    };
    store.forms.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteForm(id: string) {
    const store = loadLocalStore();
    const idx = store.forms.findIndex((f) => f.id === id);
    if (idx !== -1) {
      store.forms.splice(idx, 1);
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Flows ──
  listFlows() {
    const store = loadLocalStore();
    return { items: store.flows, count: store.flows.length };
  },
  getFlow(id: string) {
    const store = loadLocalStore();
    const item = store.flows.find((f) => f.id === id);
    if (!item) throw new Error(`Flow not found: ${id}`);
    return item;
  },
  createFlow(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('flow');
    const item = {
      id,
      title: data.title,
      description: data.description || '',
      status: 'draft',
      isLocal: true,
      createdAt: new Date().toISOString(),
    };
    store.flows.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteFlow(id: string) {
    const store = loadLocalStore();
    const idx = store.flows.findIndex((f) => f.id === id);
    if (idx !== -1) {
      store.flows.splice(idx, 1);
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Tags ──
  listTags() {
    const store = loadLocalStore();
    return { items: store.tags, count: store.tags.length };
  },
  createTag(data: any) {
    const store = loadLocalStore();
    const id = generateLocalId('tag');
    const item = {
      id,
      name: data.name,
      color: data.color || '#6366F1',
      isLocal: true,
    };
    store.tags.unshift(item);
    saveLocalStore(store);
    return item;
  },
  deleteTag(id: string) {
    const store = loadLocalStore();
    const idx = store.tags.findIndex((t) => t.id === id);
    if (idx !== -1) {
      store.tags.splice(idx, 1);
      saveLocalStore(store);
    }
    return { success: true };
  },

  // ── Trash ──
  listTrash() {
    const store = loadLocalStore();
    return { items: store.trash, count: store.trash.length };
  },
  restoreTrash(kind: string, id: string) {
    const store = loadLocalStore();
    const idx = store.trash.findIndex((t) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveLocalStore(store);
    }
    return { restored: true };
  },
  purgeTrash(kind: string, id: string) {
    const store = loadLocalStore();
    const idx = store.trash.findIndex((t) => t.id === id && t.kind === kind);
    if (idx !== -1) {
      store.trash.splice(idx, 1);
      saveLocalStore(store);
    }
    return { purged: true };
  },

  // ── Search ──
  search(query: string) {
    const q = query.toLowerCase().trim();
    const store = loadLocalStore();
    const results: any[] = [];

    for (const i of store.ideas) {
      if (i.title?.toLowerCase().includes(q) || i.content?.toLowerCase().includes(q)) {
        results.push({ kind: 'idea', id: i.id, title: i.title, snippet: i.content?.substring(0, 100), isLocal: true });
      }
    }
    for (const g of store.goals) {
      if (g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)) {
        results.push({ kind: 'goal', id: g.id, title: g.title, snippet: g.description?.substring(0, 100), isLocal: true });
      }
    }
    for (const v of store.vault) {
      if (v.name?.toLowerCase().includes(q) || v.username?.toLowerCase().includes(q)) {
        results.push({ kind: 'vault', id: v.id, title: v.name, isLocal: true });
      }
    }
    for (const e of store.events) {
      if (e.title?.toLowerCase().includes(q)) {
        results.push({ kind: 'event', id: e.id, title: e.title, isLocal: true });
      }
    }
    return results;
  },
};
