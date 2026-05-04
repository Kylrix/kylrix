import { describe, expect, it, vi } from 'vitest';
import { createForwardDirectory, createForwardSecurityGate, mergeForwardTargets } from './index';

describe('forward directory', () => {
  it('merges conversations and contacts into a searchable roster', () => {
    const targets = mergeForwardTargets(
      'me',
      [
        {
          $id: 'conv-1',
          type: 'direct',
          participants: ['me', 'user-1'],
          lastMessageAt: '2026-04-30T20:00:00.000Z',
          lastMessageText: 'hello',
        },
        {
          $id: 'conv-2',
          type: 'group',
          participants: ['me', 'user-2', 'user-3'],
          name: 'Project Crew',
          lastMessageAt: '2026-04-30T21:00:00.000Z',
          lastMessageText: 'group update',
        },
      ],
      [
        { userId: 'me', contactUserId: 'user-1', nickname: 'Bestie', isFavorite: true, isBlocked: false, relationship: 'friend', tags: ['close'] },
        { userId: 'me', contactUserId: 'user-4', nickname: 'New Contact', isFavorite: false, isBlocked: false, relationship: 'colleague', tags: [] },
      ],
      [
        { userId: 'user-1', username: 'userone', displayName: 'User One', avatar: null },
        { userId: 'user-2', username: 'usertwo', displayName: 'User Two', avatar: null },
        { userId: 'user-3', username: 'userthree', displayName: 'User Three', avatar: null },
        { userId: 'user-4', username: 'userfour', displayName: 'User Four', avatar: null },
      ],
      { query: 'user', includeGroups: true, includeContactsOnly: true },
      'connect'
    );

    expect(targets.some((target) => target.userId === 'user-1' && target.conversationId === 'conv-1')).toBe(true);
    expect(targets.some((target) => target.kind === 'conversation' && target.conversationId === 'conv-2')).toBe(true);
    expect(targets.some((target) => target.userId === 'user-4')).toBe(true);
  });

  it('gates forwarding on masterpass lock state', () => {
    const gate = createForwardSecurityGate({
      status: { isUnlocked: false },
      getMasterKey: () => null,
    });

    expect(gate.isLocked()).toBe(true);
    expect(() => gate.assertUnlocked()).toThrow('MASTERPASS_LOCKED');
  });

  it('creates and forwards using the same message API surface', async () => {
    const createConversation = vi.fn(async () => ({ $id: 'new-conv' }));
    const sendMessage = vi.fn(async () => ({ $id: 'msg-1' }));

    const directory = createForwardDirectory({
      source: {
        listConversations: async () => [],
        listContacts: async () => [],
        resolveProfiles: async () => [],
        createConversation,
        sendMessage,
      },
      security: {
        status: { isUnlocked: true },
        getMasterKey: () => ({} as CryptoKey),
      },
      sourceApp: 'note',
    });

    const target = {
      id: 'person:user-1',
      kind: 'person' as const,
      userId: 'user-1',
      conversationId: null,
      displayName: 'User One',
      sourceApps: ['note' as const],
      searchableTerms: ['user one'],
    };

    const result = await directory.forwardToTarget('me', target, {
      content: 'Forwarded resource',
      type: 'attachment',
      sourceApp: 'note',
      sourceResourceId: 'note-123',
      sourceResourceType: 'note',
    });

    expect(createConversation).toHaveBeenCalledWith({
      participantIds: ['me', 'user-1'],
      type: 'direct',
    });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'new-conv',
      senderId: 'me',
      content: 'Forwarded resource',
      type: 'attachment',
    }));
    expect(result).toEqual({ $id: 'msg-1' });
  });
});
