import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findWorkspaceConversationInternal, createConversationTransactionalInternal } from './internal/chat';

const mockRows: any[] = [];

vi.mock('@/lib/db', () => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn((_cond) => chain);
  chain.limit = vi.fn((_n) => Promise.resolve(mockRows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn((val) => {
    mockRows.push({ ...val, id: val.id });
    return chain;
  });
  chain.onConflictDoNothing = vi.fn(() => Promise.resolve());
  return {
    db: chain,
    conversations: { contextId: 'contextId' },
  };
});

describe('Workspace Hangouts Unique Row ID Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows.length = 0;
  });

  it('findWorkspaceConversationInternal attempts lookup by workspace contextId', async () => {
    const workspaceId = 'workspace_123';
    const mockDoc = { id: `ws-${workspaceId}`, name: 'Workspace Discussion', contextType: 'workspace', contextId: workspaceId };
    mockRows.push(mockDoc);

    const result = await findWorkspaceConversationInternal(workspaceId);

    expect(result?.$id).toBe(`ws-${workspaceId}`);
  });

  it('findWorkspaceConversationInternal returns null if no conversation found', async () => {
    const workspaceId = 'workspace_legacy';
    const result = await findWorkspaceConversationInternal(workspaceId);
    expect(result).toBeNull();
  });

  it('createConversationTransactionalInternal creates conversation with compound ws-[workspaceId] ID for workspaces', async () => {
    const workspaceId = 'workspace_456';
    const actorId = 'user_001';

    const conversation = await createConversationTransactionalInternal({
      actorId,
      participants: [actorId],
      type: 'group',
      name: 'Workspace Discussion',
      isEncrypted: false,
      encryptionVersion: '1.0',
      contextType: 'workspace',
      contextId: workspaceId,
      isWorkspace: true,
      isPublic: true,
    });

    expect(conversation.$id).toBe(`ws-${workspaceId}`);
    expect(mockRows.length).toBe(1);
    expect(mockRows[0].id).toBe(`ws-${workspaceId}`);
  });
});
