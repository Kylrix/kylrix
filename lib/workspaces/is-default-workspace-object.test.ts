import { describe, it, expect } from 'vitest';
import { isDefaultWorkspaceObject } from './is-default-workspace-object';

describe('isDefaultWorkspaceObject', () => {
  it('returns true for plain personal objects without workspace properties', () => {
    const item = { $id: 'note_1', title: 'Personal Note', content: 'hello' };
    expect(isDefaultWorkspaceObject(item)).toBe(true);
  });

  it('returns true for null or undefined input', () => {
    expect(isDefaultWorkspaceObject(null as any)).toBe(true);
    expect(isDefaultWorkspaceObject(undefined as any)).toBe(true);
  });

  it('returns false when isWorkspace boolean or string/number flags are set', () => {
    expect(isDefaultWorkspaceObject({ isWorkspace: true })).toBe(false);
    expect(isDefaultWorkspaceObject({ is_workspace: 'true' })).toBe(false);
    expect(isDefaultWorkspaceObject({ isWorkspaceItem: 1 })).toBe(false);
    expect(isDefaultWorkspaceObject({ isWorkspace: '1' })).toBe(false);
  });

  it('returns false when assigned to a custom named workspace or project ID', () => {
    expect(isDefaultWorkspaceObject({ projectId: 'ws_engineering' })).toBe(false);
    expect(isDefaultWorkspaceObject({ project_id: 'proj_marketing' })).toBe(false);
    expect(isDefaultWorkspaceObject({ workspaceId: 'ws_design' })).toBe(false);
    expect(isDefaultWorkspaceObject({ workspace_id: 'ws_finance' })).toBe(false);
  });

  it('returns true when projectId is set to inbox, personal, or default', () => {
    expect(isDefaultWorkspaceObject({ projectId: 'inbox' })).toBe(true);
    expect(isDefaultWorkspaceObject({ projectId: 'personal' })).toBe(true);
    expect(isDefaultWorkspaceObject({ projectId: 'default' })).toBe(true);
  });

  it('returns false when tags array contains workspace tags', () => {
    expect(isDefaultWorkspaceObject({ tags: ['project:alpha'] })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: ['workspace:team'] })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: ['ws:dev'] })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: ['isWorkspace'] })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: ['workspace'] })).toBe(false);
  });

  it('returns true when tags array contains normal non-workspace tags', () => {
    expect(isDefaultWorkspaceObject({ tags: ['urgent', 'ideas', 'todo'] })).toBe(true);
  });

  it('returns false when tags string contains workspace prefix', () => {
    expect(isDefaultWorkspaceObject({ tags: 'workspace:team,urgent' })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: 'project:alpha' })).toBe(false);
    expect(isDefaultWorkspaceObject({ tags: 'ws:dev' })).toBe(false);
  });

  it('returns true when tags string is a normal string without workspace markers', () => {
    expect(isDefaultWorkspaceObject({ tags: 'personal,note,starred' })).toBe(true);
  });
});
