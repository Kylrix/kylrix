import { describe, it, expect, vi } from 'vitest';
import {
  getJailedWorkspaceId,
  isWorkspaceJailed,
  enforceWorkspaceJailing,
  assertObjectInWorkspace,
  WorkspaceJailError,
} from './jailing';
import type { ApiActor } from '@/lib/api/guard';

describe('Workspace Jailing System', () => {
  const jailedActor: ApiActor = {
    userId: 'user-1',
    kind: 'pat',
    category: 'workspace_pat',
    workspaceId: 'ws-alpha',
    scopes: ['notes:read', 'goals:read'],
  };

  const unjailedActor: ApiActor = {
    userId: 'user-1',
    kind: 'pat',
    category: 'user_pat',
    workspaceId: null,
    scopes: ['notes:read', 'goals:read'],
  };

  it('detects jailed actors correctly', () => {
    expect(getJailedWorkspaceId(jailedActor)).toBe('ws-alpha');
    expect(isWorkspaceJailed(jailedActor)).toBe(true);

    expect(getJailedWorkspaceId(unjailedActor)).toBeNull();
    expect(isWorkspaceJailed(unjailedActor)).toBe(false);
  });

  it('auto-binds omitted workspaceId to jailed workspace', () => {
    expect(enforceWorkspaceJailing(jailedActor)).toBe('ws-alpha');
    expect(enforceWorkspaceJailing(jailedActor, null)).toBe('ws-alpha');
    expect(enforceWorkspaceJailing(jailedActor, undefined)).toBe('ws-alpha');
  });

  it('allows explicit match for jailed workspace', () => {
    expect(enforceWorkspaceJailing(jailedActor, 'ws-alpha')).toBe('ws-alpha');
  });

  it('strictly forbids accessing a different workspace when jailed', () => {
    expect(() => enforceWorkspaceJailing(jailedActor, 'ws-beta')).toThrow(WorkspaceJailError);
  });

  it('preserves requested workspace for unjailed actors', () => {
    expect(enforceWorkspaceJailing(unjailedActor, null)).toBeNull();
    expect(enforceWorkspaceJailing(unjailedActor, 'ws-beta')).toBe('ws-beta');
  });

  it('verifies object membership in workspace via direct row fields', async () => {
    const mockTables: any = {
      listRows: vi.fn().mockResolvedValue({ rows: [] }),
    };

    // Direct projectId match
    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'note', 'note-1', { projectId: 'ws-alpha' })
    ).resolves.not.toThrow();

    // Metadata projectId match
    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'note', 'note-2', {
        metadata: JSON.stringify({ projectId: 'ws-alpha' }),
      })
    ).resolves.not.toThrow();

    // Tag match
    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'goal', 'goal-1', {
        tags: ['workspace:ws-alpha'],
      })
    ).resolves.not.toThrow();
  });

  it('verifies object membership via project_objects join table', async () => {
    const mockTables: any = {
      listRows: vi.fn().mockResolvedValue({
        rows: [{ entityId: 'goal-joined', projectId: 'ws-alpha' }],
      }),
    };

    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'goal', 'goal-joined', {})
    ).resolves.not.toThrow();
  });

  it('strictly rejects personal or mismatched objects for jailed actor', async () => {
    const mockTables: any = {
      listRows: vi.fn().mockResolvedValue({ rows: [] }),
    };

    // Personal item (no workspace link)
    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'goal', 'personal-goal', {
        userId: 'user-1',
        projectId: null,
      })
    ).rejects.toThrow(WorkspaceJailError);

    // Belonging to another workspace
    await expect(
      assertObjectInWorkspace(mockTables, jailedActor, 'note', 'foreign-note', {
        userId: 'user-1',
        projectId: 'ws-other',
      })
    ).rejects.toThrow(WorkspaceJailError);
  });

  it('passes through for unjailed actors', async () => {
    const mockTables: any = {
      listRows: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await expect(
      assertObjectInWorkspace(mockTables, unjailedActor, 'goal', 'personal-goal', {
        userId: 'user-1',
      })
    ).resolves.not.toThrow();
  });
});
