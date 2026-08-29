import { describe, expect, it } from 'vitest';
import { buildApiPath, createApiModulePaths } from './index';
import { API_V1_SEGMENTS, isWorkspaceSegment, workspaceIdParam } from './routes';

describe('api helpers', () => {
  it('builds clean api paths', () => {
    expect(buildApiPath('/api/', '/connect/', '/messages/')).toBe('/api/connect/messages');
  });

  it('creates v1 resource namespaces by default', () => {
    const paths = createApiModulePaths();
    expect(paths.me).toBe('/api/v1/me');
    expect(paths.mcp).toBe('/api/v1/mcp');
    expect(paths.goals).toBe('/api/v1/goals');
    expect(paths.flows).toBe('/api/v1/flows');
    expect(paths.token.root).toBe('/api/v1/token');
    expect(paths.token.scopesGrant).toBe('/api/v1/token/scopes/grant');
    expect(paths.connect.messages).toBe('/api/v1/connect/messages');
    expect(paths.forward.send).toBe('/api/v1/forward/send');
  });

  it('allows legacy base override', () => {
    const paths = createApiModulePaths('/api');
    expect(paths.connect.messages).toBe('/api/connect/messages');
    expect(paths.forward.send).toBe('/api/forward/send');
  });

  it('exposes REST dispatch segment constants', () => {
    expect(API_V1_SEGMENTS.notes).toBe('notes');
    expect(isWorkspaceSegment('workspaces')).toBe(true);
    expect(isWorkspaceSegment('projects')).toBe(true);
    expect(isWorkspaceSegment('notes')).toBe(false);
    const params = new URLSearchParams('workspaceId=ws1');
    expect(workspaceIdParam(params)).toBe('ws1');
    expect(workspaceIdParam(new URLSearchParams('projectId=p1'))).toBe('p1');
  });
});
