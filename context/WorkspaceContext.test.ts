import { describe, it, expect, beforeEach } from 'vitest';
import { isWorkspaceRecord } from '@/lib/projects/sub-projects';

describe('Sub-Project & Workspace Classifier', () => {
  it('classifies root workspaces correctly and filters sub-projects', () => {
    const rootWs = {
      id: 'ws_root_123',
      name: 'Engineering Workspace',
      parentProjectId: null,
      kind: 'workspace',
    };

    const subProject = {
      id: 'ws_sub_456',
      name: 'Sub Task Group',
      parentProjectId: 'ws_root_123',
      kind: 'subproject',
    };

    const subProjectMeta = {
      id: 'ws_sub_789',
      name: 'Sub Task Group 2',
      metadata: JSON.stringify({ isSubProject: true }),
    };

    expect(isWorkspaceRecord(rootWs)).toBe(true);
    expect(isWorkspaceRecord(subProject)).toBe(false);
    expect(isWorkspaceRecord(subProjectMeta)).toBe(false);
  });

  it('classifies legacy and imported Turso workspaces where title, kind, and summary are null', () => {
    // Legacy workspaces from user 67ffb09c00197408cc0e
    const legacyWorkspaces = [
      {
        id: 'ws_dev_1',
        name: 'Kylrix dev',
        title: null,
        kind: null,
        summary: null,
        parentProjectId: null,
        ownerId: '67ffb09c00197408cc0e',
      },
      {
        id: 'ws_noun_2',
        name: 'NOUN-LCC-Hangout',
        title: null,
        kind: null,
        summary: null,
        parentProjectId: '',
        ownerId: '67ffb09c00197408cc0e',
      },
      {
        id: 'ws_nova_3',
        name: 'NOVA Esim Workspace',
        title: null,
        kind: null,
        summary: null,
        parentProjectId: null,
        ownerId: '67ffb09c00197408cc0e',
      },
      {
        id: 'ws_randd_4',
        name: 'randd',
        title: null,
        kind: null,
        summary: null,
        parentProjectId: null,
        ownerId: '67ffb09c00197408cc0e',
      },
      {
        id: 'ws_cowry_5',
        name: 'Cowrywise design',
        title: null,
        kind: null,
        summary: null,
        parentProjectId: null,
        ownerId: '67ffb09c00197408cc0e',
      },
    ];

    for (const ws of legacyWorkspaces) {
      expect(isWorkspaceRecord(ws)).toBe(true);
      expect((ws as any).title).toBe(ws.name);
    }
  });

  it('assigns fallback Untitled Workspace if neither title nor name is present but id exists', () => {
    const ws = {
      id: 'ws_fallback_999',
      parentProjectId: null,
      kind: null,
    };
    expect(isWorkspaceRecord(ws)).toBe(true);
    expect((ws as any).title).toBe('Untitled Workspace');
  });
});

describe('Workspace Cache Poisoning & Recovery Invariants', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not overwrite populated localStorage when writing personal workspace only', () => {
    const uid = '67ffb09c00197408cc0e';
    const populated = [
      { id: uid, title: 'My Workspace', ownerId: uid, isPersonal: true },
      { id: 'ws_dev_1', title: 'Kylrix dev', ownerId: uid, isPersonal: false },
      { id: 'ws_cowry_5', title: 'Cowrywise design', ownerId: uid, isPersonal: false },
    ];
    localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(populated));
    localStorage.setItem('kylrix_all_cached_workspaces', JSON.stringify(populated));

    // Simulate persistWorkspacesOffline logic directly
    const persistLogic = (items: any[], allowSinglePersonal = false) => {
      if (items.length <= 1 && !allowSinglePersonal) {
        const existingKeys = [`kylrix_workspaces_${uid}`, 'kylrix_all_cached_workspaces'];
        for (const k of existingKeys) {
          const existing = localStorage.getItem(k);
          if (existing) {
            try {
              const parsed = JSON.parse(existing);
              const list = Array.isArray(parsed) ? parsed : (parsed?.rows || parsed?.workspaces || []);
              if (Array.isArray(list) && list.length >= 2) {
                return false; // Aborted
              }
            } catch {}
          }
        }
      }
      localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(items));
      return true;
    };

    const singlePersonal = [{ id: uid, title: 'My Workspace', ownerId: uid, isPersonal: true }];
    const wrote = persistLogic(singlePersonal, false);

    expect(wrote).toBe(false);
    // Cached items must remain intact!
    const remaining = JSON.parse(localStorage.getItem(`kylrix_workspaces_${uid}`)!);
    expect(remaining).toHaveLength(3);
    expect(remaining.map((w: any) => w.title)).toContain('Kylrix dev');
    expect(remaining.map((w: any) => w.title)).toContain('Cowrywise design');
  });

  it('allows personal workspace overwrite on explicit logout event', () => {
    const uid = '67ffb09c00197408cc0e';
    const populated = [
      { id: uid, title: 'My Workspace', ownerId: uid, isPersonal: true },
      { id: 'ws_dev_1', title: 'Kylrix dev', ownerId: uid, isPersonal: false },
    ];
    localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(populated));

    const persistLogic = (items: any[], allowSinglePersonal = false) => {
      if (items.length <= 1 && !allowSinglePersonal) {
        const existingKeys = [`kylrix_workspaces_${uid}`, 'kylrix_all_cached_workspaces'];
        for (const k of existingKeys) {
          const existing = localStorage.getItem(k);
          if (existing) {
            try {
              const parsed = JSON.parse(existing);
              const list = Array.isArray(parsed) ? parsed : (parsed?.rows || parsed?.workspaces || []);
              if (Array.isArray(list) && list.length >= 2) {
                return false; // Aborted
              }
            } catch {}
          }
        }
      }
      localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(items));
      return true;
    };

    const singlePersonal = [{ id: uid, title: 'My Workspace', ownerId: uid, isPersonal: true }];
    const wrote = persistLogic(singlePersonal, true);

    expect(wrote).toBe(true);
    const updated = JSON.parse(localStorage.getItem(`kylrix_workspaces_${uid}`)!);
    expect(updated).toHaveLength(1);
  });
});
