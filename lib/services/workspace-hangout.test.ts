import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findWorkspaceConversationInternal, createConversationTransactionalInternal } from './internal/chat';

vi.mock('@/lib/appwrite/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/appwrite/config', () => ({
  APPWRITE_CONFIG: {
    DATABASES: { CHAT: 'chat_db', PASSWORD_MANAGER: 'pm_db' },
    TABLES: {
      CHAT: {
        CONVERSATIONS: 'conversations',
        MESSAGES: 'messages',
        MESSAGE_REACTIONS: 'message_reactions',
        PROFILES: 'profiles',
        JOIN_REQUESTS: 'join_requests',
        EPOCHS: 'epochs',
      },
      PASSWORD_MANAGER: { KEY_MAPPING: 'key_mapping', IDENTITIES: 'identities' },
    },
    BUCKETS: { MESSAGES: 'messages_bucket', GROUP_AVATARS: 'group_avatars_bucket' },
  },
}));

const mockGetRow = vi.fn();
const mockListRows = vi.fn();
const mockCreateRow = vi.fn();

vi.mock('@/lib/appwrite-admin', () => ({
  createSystemClient: () => ({
    databases: {
      getRow: mockGetRow,
      listRows: mockListRows,
      createRow: mockCreateRow,
    },
  }),
  createSystemTablesDB: () => ({
    createRow: mockCreateRow,
    getRow: mockGetRow,
    listRows: mockListRows,
  }),
}));

vi.mock('./internal/transaction', () => ({
  withSystemTransaction: async (fn: (txId: string) => Promise<any>) => {
    return await fn('mock-tx-id');
  },
}));

describe('Workspace Hangouts Unique Row ID Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findWorkspaceConversationInternal attempts direct lookup with compound ws-[workspaceId] row ID', async () => {
    const workspaceId = 'workspace_123';
    const mockDoc = { $id: `ws-${workspaceId}`, name: 'Workspace Discussion', contextType: 'workspace', contextId: workspaceId };

    mockGetRow.mockResolvedValueOnce(mockDoc);

    const result = await findWorkspaceConversationInternal(workspaceId);

    expect(mockGetRow).toHaveBeenCalledWith('chat_db', 'conversations', `ws-${workspaceId}`);
    expect(result).toEqual(mockDoc);
  });

  it('findWorkspaceConversationInternal falls back to list queries if compound ID is not found', async () => {
    const workspaceId = 'workspace_legacy';
    mockGetRow.mockRejectedValueOnce(new Error('Document not found'));
    mockListRows.mockResolvedValueOnce({
      rows: [{ $id: 'legacy_id', name: 'Legacy Workspace Discussion', contextType: 'workspace', contextId: workspaceId }],
    });

    const result = await findWorkspaceConversationInternal(workspaceId);

    expect(mockGetRow).toHaveBeenCalledWith('chat_db', 'conversations', `ws-${workspaceId}`);
    expect(mockListRows).toHaveBeenCalled();
    expect(result?.$id).toBe('legacy_id');
  });

  it('createConversationTransactionalInternal creates conversation with compound ws-[workspaceId] ID for workspaces', async () => {
    const workspaceId = 'workspace_456';
    const actorId = 'user_001';

    // 1. Initial check in findWorkspaceConversationInternal fails (does not exist yet)
    mockGetRow.mockRejectedValueOnce(new Error('Document not found'));
    mockListRows.mockResolvedValueOnce({ rows: [] });
    mockListRows.mockResolvedValueOnce({ rows: [] });

    // 2. Fetch back fresh document after creation succeeds
    mockGetRow.mockResolvedValueOnce({
      $id: `ws-${workspaceId}`,
      name: 'Workspace Discussion',
      type: 'group',
      contextType: 'workspace',
      contextId: workspaceId,
      creatorId: actorId,
    });

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
    expect(mockCreateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: 'chat_db',
        tableId: 'conversations',
        rowId: `ws-${workspaceId}`,
      })
    );
  });

  it('createConversationTransactionalInternal catches duplicate constraint error and returns existing conversation', async () => {
    const workspaceId = 'workspace_789';
    const actorId = 'user_002';
    const existingDoc = { $id: `ws-${workspaceId}`, name: 'Existing Hangout', contextType: 'workspace', contextId: workspaceId };

    // Initially findWorkspaceConversationInternal returns null (probe fails or returns empty)
    mockGetRow.mockRejectedValueOnce(new Error('Document not found'));
    mockListRows.mockResolvedValueOnce({ rows: [] });
    mockListRows.mockResolvedValueOnce({ rows: [] });

    // Transaction fails with duplicate error (409 / already exists)
    mockCreateRow.mockImplementationOnce(() => {
      const err = new Error('Document already exists');
      (err as any).code = 409;
      throw err;
    });

    // When error is caught, findWorkspaceConversationInternal finds the existing doc by ws- ID
    mockGetRow.mockResolvedValueOnce(existingDoc);

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

    expect(conversation).toEqual(existingDoc);
  });
});
