import { describe, expect, it, vi } from 'vitest';
import { KylrixConnect } from './connect';

describe('KylrixConnect', () => {
  it('should successfully send a message with auto-populated timestamps', async () => {
    const mockSdk = {
      createRow: vi.fn().mockImplementation(async (db, table, data) => ({
        $id: 'msg-123',
        ...data})),
      getRow: vi.fn(),
      updateRow: vi.fn(),
    };

    const connect = new KylrixConnect(mockSdk);
    const messageData = {
      conversationId: 'conv-456',
      senderId: 'user-789',
      type: 'text' as const,
      content: 'Hello, World!',
    };

    const result = await connect.sendMessage('db-id', 'table-id', messageData);

    expect(mockSdk.createRow).toHaveBeenCalledTimes(1);
    expect(mockSdk.createRow).toHaveBeenCalledWith('db-id', 'table-id', expect.objectContaining({
      conversationId: 'conv-456',
      senderId: 'user-789',
      type: 'text',
      content: 'Hello, World!'}));
    expect(result).toHaveProperty('$id', 'msg-123');
    expect(result).toHaveProperty('createdAt');
    expect(result).toHaveProperty('updatedAt');
  });

  it('should mark a message as read by adding the user ID to the readBy list uniquely', async () => {
    const existingMessage = {
      $id: 'msg-123',
      readBy: ['user-abc'],
    };

    const mockSdk = {
      createRow: vi.fn(),
      getRow: vi.fn().mockResolvedValue(existingMessage),
      updateRow: vi.fn().mockImplementation(async (db, table, rowId, data) => ({
        ...existingMessage,
        ...data})),
    };

    const connect = new KylrixConnect(mockSdk);

    // Test adding a new unique user
    const result1 = await connect.markAsRead('db-id', 'table-id', 'msg-123', 'user-xyz');
    expect(mockSdk.getRow).toHaveBeenCalledWith('db-id', 'table-id', 'msg-123');
    expect(mockSdk.updateRow).toHaveBeenCalledWith('db-id', 'table-id', 'msg-123', {
      readBy: ['user-abc', 'user-xyz'],
    });
    expect(result1.readBy).toEqual(['user-abc', 'user-xyz']);

    // Test adding an already existing user (should remain unique)
    mockSdk.getRow.mockResolvedValueOnce({
      $id: 'msg-123',
      readBy: ['user-abc', 'user-xyz']});
    await connect.markAsRead('db-id', 'table-id', 'msg-123', 'user-xyz');
    expect(mockSdk.updateRow).toHaveBeenLastCalledWith('db-id', 'table-id', 'msg-123', {
      readBy: ['user-abc', 'user-xyz'],
    });
  });
});
