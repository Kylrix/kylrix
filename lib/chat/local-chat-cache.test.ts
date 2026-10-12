import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readMessagesLocal,
  writeMessagesLocal,
  readChatsListLocal,
  writeChatsListLocal,
  sanitizeMessagesForRest,
  sanitizeConversationListForRest,
  peekMessagesMemory,
  peekChatsListMemory,
  clearChatsListMemory,
  isLikelyChatCiphertext,
} from './local-chat-cache';
import { LocalEngine } from '@/lib/services/LocalEngine';

vi.mock('@/lib/services/LocalEngine', () => {
  const store = new Map<string, any>();
  return {
    LocalEngine: {
      cacheGet: vi.fn(async (key: string) => store.get(key) || null),
      cacheSet: vi.fn(async (key: string, val: any) => {
        store.set(key, val);
      }),
      clear: () => store.clear(),
    },
  };
});

describe('local-chat-cache', () => {
  beforeEach(() => {
    clearChatsListMemory();
    (LocalEngine as any).clear();
    vi.clearAllMocks();
  });

  it('detects likely ciphertext accurately', () => {
    expect(isLikelyChatCiphertext('https://example.com')).toBe(false);
    expect(isLikelyChatCiphertext('hello world')).toBe(false);
    expect(isLikelyChatCiphertext('{"iv":"123","data":"xyz"}')).toBe(true);
    expect(isLikelyChatCiphertext('[DECRYPTION_FAILED]')).toBe(true);
  });

  it('sanitizes messages for rest when encrypted', () => {
    const rawPlaintext = [
      { $id: 'm1', content: 'Secret message hello' },
      { $id: 'm2', content: '{"iv":"abc","data":"xyz"}' },
    ];
    const sanitized = sanitizeMessagesForRest(rawPlaintext, true);

    expect(sanitized[0].content).toBe(''); // Plaintext stripped
    expect(sanitized[1].content).toBe('{"iv":"abc","data":"xyz"}'); // Ciphertext kept
  });

  it('keeps messages intact when not encrypted', () => {
    const rawPlaintext = [
      { $id: 'm1', content: 'Open discussion post' },
    ];
    const sanitized = sanitizeMessagesForRest(rawPlaintext, false);

    expect(sanitized[0].content).toBe('Open discussion post');
  });

  it('writes and reads messages locally in 0ms', async () => {
    const convId = 'conv_test_1';
    const testMsgs = [
      { $id: 'm100', conversationId: convId, content: 'Hello local world' },
    ];

    writeMessagesLocal(convId, testMsgs, false);

    // Instant memory peek
    expect(peekMessagesMemory(convId)).toEqual(testMsgs);

    // Async LocalEngine read
    const local = await readMessagesLocal(convId);
    expect(local).toEqual(testMsgs);
  });

  it('writes and reads conversation lists locally', async () => {
    const testChats = [
      { $id: 'c1', name: 'General Chat', isEncrypted: false, lastMessageText: 'Hey!' },
    ];

    writeChatsListLocal(testChats);

    expect(peekChatsListMemory()).toEqual(testChats);

    const readBack = await readChatsListLocal();
    expect(readBack).toEqual(testChats);
  });

  it('sanitizes conversation list preview text for encrypted chats', () => {
    const list = [
      { $id: 'c1', isEncrypted: true, lastMessageText: 'Unencrypted preview' },
      { $id: 'c2', isEncrypted: true, lastMessageText: '{"iv":"abc","data":"xyz"}' },
      { $id: 'c3', isEncrypted: false, lastMessageText: 'Unencrypted open' },
    ];

    const sanitized = sanitizeConversationListForRest(list);
    expect(sanitized[0].lastMessageText).toBe('');
    expect(sanitized[1].lastMessageText).toBe('{"iv":"abc","data":"xyz"}');
    expect(sanitized[2].lastMessageText).toBe('Unencrypted open');
  });

  it('isolates conversation lists per user and clears cleanly on logout', async () => {
    const userAChats = [{ $id: 'c_user_a', name: 'User A Hangout' }];
    const userBChats = [{ $id: 'c_user_b', name: 'User B Hangout' }];

    // Write for user A
    writeChatsListLocal(userAChats, 'user_a');
    expect(peekChatsListMemory('user_a')).toEqual(userAChats);
    expect(peekChatsListMemory('user_b')).toEqual([]); // User B sees nothing from User A

    // Write for user B
    writeChatsListLocal(userBChats, 'user_b');
    expect(peekChatsListMemory('user_b')).toEqual(userBChats);
    expect(peekChatsListMemory('user_a')).toEqual([]); // User A is no longer in memory

    // Read back user A from LocalEngine
    const readUserA = await readChatsListLocal('user_a');
    expect(readUserA).toEqual(userAChats);

    // Read back user B from LocalEngine
    const readUserB = await readChatsListLocal('user_b');
    expect(readUserB).toEqual(userBChats);

    // Logout event clears all memory
    window.dispatchEvent(new CustomEvent('kylrix:auth:logout'));
    expect(peekChatsListMemory('user_b')).toEqual([]);
    expect(peekChatsListMemory('user_a')).toEqual([]);
  });
});
