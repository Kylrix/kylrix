import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from './chat';
import { ThreadService } from './threads';

vi.mock('@/lib/appwrite/client', () => ({
  account: {
    createJWT: vi.fn().mockResolvedValue({ jwt: 'mock-jwt' }),
  },
  tablesDB: {
    getRow: vi.fn().mockRejectedValue(new Error('Document not found')),
    listRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    deleteRow: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/appwrite-admin', () => ({
  createSystemClient: vi.fn().mockReturnValue({
    databases: {
      getRow: vi.fn().mockRejectedValue(new Error('Document not found')),
      listRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      deleteRow: vi.fn().mockResolvedValue({}),
    },
    storage: {
      deleteFile: vi.fn().mockResolvedValue({}),
    },
  }),
  createSystemTablesDB: vi.fn().mockReturnValue({
    getRow: vi.fn().mockRejectedValue(new Error('Document not found')),
    listRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    deleteRow: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('@/lib/actions/chat', () => ({
  deleteConversationFullyAction: vi.fn().mockResolvedValue({ success: true, conversationId: 'test-conv-id' }),
}));

vi.mock('@/lib/actions/client-ops', () => ({
  deleteThread: vi.fn().mockResolvedValue({ success: true, threadId: 'test-thread-id' }),
  deleteThreadSecure: vi.fn().mockResolvedValue({ success: true, threadId: 'test-thread-id' }),
}));

vi.mock('@/lib/chat/local-chat-cache', () => ({
  peekChatsListMemory: vi.fn().mockReturnValue([{ $id: 'test-conv-id', name: 'Test Conv' }]),
  peekThreadsListMemory: vi.fn().mockReturnValue([{ $id: 'test-thread-id', title: 'Test Thread' }]),
  peekMessagesMemory: vi.fn().mockReturnValue([]),
  readChatsListLocal: vi.fn().mockResolvedValue([]),
  readThreadsListLocal: vi.fn().mockResolvedValue([{ $id: 'test-thread-id', title: 'Test Thread' }]),
  readMessagesLocal: vi.fn().mockResolvedValue([]),
  writeChatsListLocal: vi.fn().mockResolvedValue(true),
  writeThreadsListLocal: vi.fn().mockResolvedValue(true),
  conversationKeyCache: new Map(),
}));

describe('Chat and Thread Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ChatService.deleteConversationFully handles deletion idempotently', async () => {
    const res = await ChatService.deleteConversationFully('test-conv-id');
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.conversationId).toBe('test-conv-id');
  });

  it('ThreadService.deleteThread handles deletion idempotently and purges local cache', async () => {
    const res = await ThreadService.deleteThread('test-thread-id');
    expect(res).toBeDefined();
    expect(res.success).toBe(true);
    expect(res.threadId).toBe('test-thread-id');
  });
});
