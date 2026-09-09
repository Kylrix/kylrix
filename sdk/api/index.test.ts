import { describe, expect, it } from 'vitest';
import { buildApiPath, apiV1Path, createApiModulePaths } from './index';
import { API_V1_SEGMENTS, isWorkspaceSegment, workspaceIdParam } from './routes';

describe('api helpers', () => {
  it('builds clean api paths', () => {
    expect(buildApiPath('/api/', '/connect/', '/messages/')).toBe('/api/connect/messages');
    expect(apiV1Path('notes', '123')).toBe('/api/v1/notes/123');
  });

  it('creates v1 resource namespaces by default', () => {
    const paths = createApiModulePaths();
    expect(paths.me).toBe('/api/v1/me');
    expect(paths.mcp).toBe('/api/v1/mcp');
    expect(paths.goals).toBe('/api/v1/goals');
    expect(paths.notes).toBe('/api/v1/notes');
    expect(paths.workspaces).toBe('/api/v1/workspaces');
    expect(paths.projects).toBe('/api/v1/projects');
    expect(paths.events).toBe('/api/v1/events');
    expect(paths.forms).toBe('/api/v1/forms');
    expect(paths.tags).toBe('/api/v1/tags');
    expect(paths.trash).toBe('/api/v1/trash');
    expect(paths.moments).toBe('/api/v1/moments');
    expect(paths.chats).toBe('/api/v1/chats');
    expect(paths.agents).toBe('/api/v1/agents');
    expect(paths.threads).toBe('/api/v1/threads');
    expect(paths.vault).toBe('/api/v1/vault');
    expect(paths.pats).toBe('/api/v1/pats');
    expect(paths.flows.root).toBe('/api/v1/flows');
    expect(paths.flows.installations).toBe('/api/v1/flows/installations');
    expect(paths.flows.flowInstallations('flow1')).toBe('/api/v1/flows/flow1/installations');
    expect(paths.token.root).toBe('/api/v1/token');
    expect(paths.token.scopes).toBe('/api/v1/token/scopes');
    expect(paths.connect.messages).toBe('/api/v1/connect/messages');
    expect(paths.connect.reactions).toBe('/api/v1/connect/message-reactions');
    expect(paths.connect.joinRequests).toBe('/api/v1/connect/join-requests');
    expect(paths.connect.repair).toBe('/api/v1/connect/repair');
    expect(paths.forward.conversations).toBe('/api/v1/forward/conversations');
    expect(paths.forward.send).toBe('/api/v1/forward/send');
    expect(paths.forward.targets).toBe('/api/v1/forward/targets');
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
    expect(workspaceIdParam(new URLSearchParams())).toBeNull();
  });
});
