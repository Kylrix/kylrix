import { describe, it, expect } from 'vitest';
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
});
