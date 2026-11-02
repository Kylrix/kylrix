import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapWorkspaceProjectRows,
  persistWorkspacesOfflineStore,
  WorkspaceItem,
} from '@/context/WorkspaceContext';

describe('Workspace Domain Invariants (workspace-invariants.test.tsx)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Workspace Discovery & Switcher Integrity: mapWorkspaceProjectRows', () => {
    it('maps diverse database shapes including legacy rows where title is null, name is present, and kind is null', () => {
      const legacyRows = [
        {
          id: 'ws_legacy_1',
          name: 'Core Architecture',
          title: null,
          kind: null,
          parentProjectId: null,
          ownerId: 'usr_test_123',
        },
        {
          $id: 'ws_legacy_2',
          name: 'AI Agent Enclave',
          title: '',
          kind: undefined,
          parentProjectId: '',
          ownerId: 'usr_test_123',
        },
        {
          id: 'ws_fallback_3',
          title: null,
          name: null,
          parentProjectId: null,
          ownerId: 'usr_test_123',
        },
      ];

      const mapped = mapWorkspaceProjectRows(legacyRows, 'usr_test_123');

      expect(mapped).toHaveLength(3);
      expect(mapped[0].title).toBe('Core Architecture');
      expect(mapped[0].id).toBe('ws_legacy_1');
      expect(mapped[1].title).toBe('AI Agent Enclave');
      expect(mapped[1].id).toBe('ws_legacy_2');
      expect(mapped[2].title).toBe('Untitled Workspace');
      expect(mapped[2].id).toBe('ws_fallback_3');
    });

    it('retains all valid root projects (!parentProjectId) and filters out subprojects', () => {
      const mixedProjects = [
        {
          id: 'ws_root_a',
          title: 'Root Workspace A',
          parentProjectId: null,
          kind: 'workspace',
        },
        {
          id: 'ws_root_b',
          name: 'Root Workspace B',
          parentProjectId: undefined,
        },
        {
          id: 'ws_sub_c',
          title: 'Sub Project C',
          parentProjectId: 'ws_root_a',
          kind: 'subproject',
        },
        {
          id: 'ws_sub_d',
          title: 'Sub Project D with metadata',
          parentProjectId: null,
          metadata: JSON.stringify({ isSubProject: true }),
        },
      ];

      const mapped = mapWorkspaceProjectRows(mixedProjects, 'usr_test_123');

      expect(mapped).toHaveLength(2);
      expect(mapped.map((w) => w.id)).toEqual(['ws_root_a', 'ws_root_b']);
    });
  });

  describe('Anti-Cache-Poisoning Invariant: persistWorkspacesOfflineStore', () => {
    it('strictly aborts overwriting cache when passing only [personalWorkspace] if 2+ workspaces are already cached', () => {
      const uid = 'usr_agent_999';
      const multiCached: WorkspaceItem[] = [
        { id: uid, title: 'Personal Space', ownerId: uid, isPersonal: true },
        { id: 'ws_alpha', title: 'Alpha Team', ownerId: uid, isPersonal: false },
        { id: 'ws_beta', title: 'Beta Research', ownerId: uid, isPersonal: false },
      ];

      localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(multiCached));
      localStorage.setItem('kylrix_all_cached_workspaces', JSON.stringify(multiCached));

      const singlePersonal: WorkspaceItem[] = [
        { id: uid, title: 'Personal Space', ownerId: uid, isPersonal: true },
      ];

      // Attempt to overwrite without allowSinglePersonal
      const persisted = persistWorkspacesOfflineStore(singlePersonal, uid, false);

      expect(persisted).toBe(false);

      // Verify localStorage was NOT overwritten
      const stored = JSON.parse(localStorage.getItem(`kylrix_workspaces_${uid}`)!);
      expect(stored).toHaveLength(3);
      expect(stored.map((w: any) => w.id)).toEqual([uid, 'ws_alpha', 'ws_beta']);
    });

    it('allows single personal overwrite only when allowSinglePersonal is explicitly true (e.g. on logout)', () => {
      const uid = 'usr_agent_999';
      const multiCached: WorkspaceItem[] = [
        { id: uid, title: 'Personal Space', ownerId: uid, isPersonal: true },
        { id: 'ws_alpha', title: 'Alpha Team', ownerId: uid, isPersonal: false },
      ];

      localStorage.setItem(`kylrix_workspaces_${uid}`, JSON.stringify(multiCached));

      const singlePersonal: WorkspaceItem[] = [
        { id: uid, title: 'Personal Space', ownerId: uid, isPersonal: true },
      ];
      const persisted = persistWorkspacesOfflineStore(singlePersonal, uid, true);

      expect(persisted).toBe(true);

      const stored = JSON.parse(localStorage.getItem(`kylrix_workspaces_${uid}`)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(uid);
    });
  });
});
