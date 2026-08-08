/**
 * Flow drafts — autosave for /flows create drawer.
 * Wired to RxDB LocalEngine (Offline-First), not localStorage.
 * Manifest = lightweight titles, content = full WorkflowChain draft.
 */
import { LocalEngine } from '@/lib/services/LocalEngine';

const DRAFT_PREFIX = 'kylrix_flow_draft_flow_';
const MANIFEST_KEY = 'kylrix_flow_drafts_manifest_v2';

export type FlowDraft = {
  id: string; // draft id e.g. draft-xxxx
  title: string;
  description: string;
  niche: string;
  steps: Array<{ actionId: string; timestamp: string; importance: 'high' | 'low' }>;
  jsonText?: string;
  updatedAt: string;
  createdAt: string;
  ready: boolean; // required fields met -> ready to sync
};

type ManifestEntry = { title: string; updatedAt: string; ready: boolean; niche: string; stepsCount: number };
type Manifest = Record<string, ManifestEntry>;

export const FlowDraftsService = {
  async saveDraft(id: string, data: Omit<FlowDraft, 'id' | 'updatedAt' | 'createdAt' | 'ready'> & { ready?: boolean }): Promise<FlowDraft> {
    if (typeof window === 'undefined') throw new Error('SSR');
    const existing = await this.getDraft(id);
    const now = new Date().toISOString();
    const draft: FlowDraft = {
      id,
      title: data.title || '',
      description: data.description || '',
      niche: data.niche || 'workspace',
      steps: Array.isArray(data.steps) ? data.steps : [],
      jsonText: data.jsonText || '',
      updatedAt: now,
      createdAt: existing?.createdAt || now,
      ready: !!data.ready,
    };
    await LocalEngine.cacheSet(`${DRAFT_PREFIX}${id}`, draft);
    const manifest = await this.getManifest();
    manifest[id] = {
      title: draft.title || 'Untitled',
      updatedAt: draft.updatedAt,
      ready: draft.ready,
      niche: draft.niche,
      stepsCount: draft.steps.length,
    };
    await LocalEngine.cacheSet(MANIFEST_KEY, manifest);
    return draft;
  },

  async getDraft(id: string): Promise<FlowDraft | null> {
    if (typeof window === 'undefined') return null;
    return (await LocalEngine.cacheGet<FlowDraft>(`${DRAFT_PREFIX}${id}`)) || null;
  },

  async hasDraft(id: string): Promise<boolean> {
    const m = await this.getManifest();
    return !!m[id];
  },

  async clearDraft(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    await LocalEngine.cacheDelete(`${DRAFT_PREFIX}${id}`);
    const manifest = await this.getManifest();
    if (manifest[id]) {
      delete manifest[id];
      await LocalEngine.cacheSet(MANIFEST_KEY, manifest);
    }
  },

  async getManifest(): Promise<Manifest> {
    if (typeof window === 'undefined') return {};
    return (await LocalEngine.cacheGet<Manifest>(MANIFEST_KEY)) || {};
  },

  async listDrafts(): Promise<FlowDraft[]> {
    if (typeof window === 'undefined') return [];
    const manifest = await this.getManifest();
    const ids = Object.keys(manifest);
    const drafts: FlowDraft[] = [];
    for (const id of ids) {
      const d = await this.getDraft(id);
      if (d) drafts.push(d);
    }
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return drafts;
  },

  async clearAll(): Promise<void> {
    if (typeof window === 'undefined') return;
    const manifest = await this.getManifest();
    for (const id of Object.keys(manifest)) {
      await LocalEngine.cacheDelete(`${DRAFT_PREFIX}${id}`);
    }
    await LocalEngine.cacheDelete(MANIFEST_KEY);
  },
};
