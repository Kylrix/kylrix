import { describe, it, expect } from 'vitest';
import { sortWorkspacesByActive, type SortableWorkspaceItem } from './sort-workspaces';

describe('sortWorkspacesByActive', () => {
  const personalWs: SortableWorkspaceItem = { id: 'user_123', title: 'My Workspace', isPersonal: true };
  const customWs1: SortableWorkspaceItem = { id: 'ws_1', title: 'Project Alpha', isPersonal: false };
  const customWs2: SortableWorkspaceItem = { id: 'ws_2', title: 'Marketing', isPersonal: false };
  const sharedWs: SortableWorkspaceItem = { id: 'ws_shared', title: 'Design Team', isPersonal: false, isShared: true };
  const agentWs: SortableWorkspaceItem = { id: 'ws_agent', title: 'Agent Kylie', isPersonal: false, isAgentic: true };

  const allWorkspaces = [personalWs, customWs1, customWs2, sharedWs, agentWs];

  it('places personal workspace at top when personal workspace is active', () => {
    const sorted = sortWorkspacesByActive(allWorkspaces, 'user_123', 'user_123');
    expect(sorted.map((w) => w.id)).toEqual(['user_123', 'ws_1', 'ws_2', 'ws_shared', 'ws_agent']);
  });

  it('places active custom workspace at top, seconded by personal workspace', () => {
    const sorted = sortWorkspacesByActive(allWorkspaces, 'ws_2', 'user_123');
    expect(sorted.map((w) => w.id)).toEqual(['ws_2', 'user_123', 'ws_1', 'ws_shared', 'ws_agent']);
  });

  it('places active shared workspace at top, seconded by personal workspace', () => {
    const sorted = sortWorkspacesByActive(allWorkspaces, 'ws_shared', 'user_123');
    expect(sorted.map((w) => w.id)).toEqual(['ws_shared', 'user_123', 'ws_1', 'ws_2', 'ws_agent']);
  });

  it('places active agent workspace at top, seconded by personal workspace', () => {
    const sorted = sortWorkspacesByActive(allWorkspaces, 'ws_agent', 'user_123');
    expect(sorted.map((w) => w.id)).toEqual(['ws_agent', 'user_123', 'ws_1', 'ws_2', 'ws_shared']);
  });

  it('handles empty or missing workspace list gracefully', () => {
    expect(sortWorkspacesByActive([], 'ws_1', 'user_123')).toEqual([]);
  });

  it('falls back to personal workspace first when activeWorkspaceId is personal or guest alias', () => {
    const sorted = sortWorkspacesByActive(allWorkspaces, 'personal', 'user_123');
    expect(sorted[0].id).toBe('user_123');
  });
});
