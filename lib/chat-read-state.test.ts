import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConversationReadAt, markConversationRead } from './chat-read-state';

describe('chat-read-state', () => {
  const userId = 'user-123';
  const conversationId = 'conv-456';
  const expectedKey = `kylrix_connect_chat_read_${userId}_${conversationId}`;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getConversationReadAt', () => {
    it('returns 0 if userId is null, undefined, or empty string', () => {
      expect(getConversationReadAt(null, conversationId)).toBe(0);
      expect(getConversationReadAt(undefined, conversationId)).toBe(0);
      expect(getConversationReadAt('', conversationId)).toBe(0);
    });

    it('returns 0 if window is undefined (SSR environment)', () => {
      vi.stubGlobal('window', undefined);
      expect(getConversationReadAt(userId, conversationId)).toBe(0);
    });

    it('returns 0 if no item exists in localStorage', () => {
      expect(getConversationReadAt(userId, conversationId)).toBe(0);
    });

    it('returns timestamp when valid ISO date string is in localStorage', () => {
      const now = new Date('2025-01-15T12:00:00.000Z');
      localStorage.setItem(expectedKey, now.toISOString());

      expect(getConversationReadAt(userId, conversationId)).toBe(now.getTime());
    });

    it('returns 0 when stored raw string is invalid date format', () => {
      localStorage.setItem(expectedKey, 'invalid-date-string');

      expect(getConversationReadAt(userId, conversationId)).toBe(0);
    });
  });

  describe('markConversationRead', () => {
    it('returns 0 and does not write to localStorage if userId is null, undefined, or empty string', () => {
      expect(markConversationRead(null, conversationId)).toBe(0);
      expect(markConversationRead(undefined, conversationId)).toBe(0);
      expect(markConversationRead('', conversationId)).toBe(0);
      expect(localStorage.length).toBe(0);
    });

    it('returns 0 and does not write to localStorage if window is undefined (SSR environment)', () => {
      vi.stubGlobal('window', undefined);
      expect(markConversationRead(userId, conversationId)).toBe(0);
    });

    it('uses current date as default readAt parameter and writes to localStorage', () => {
      const testDate = new Date('2025-02-10T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(testDate);

      const timestamp = markConversationRead(userId, conversationId);

      expect(timestamp).toBe(testDate.getTime());
      expect(localStorage.getItem(expectedKey)).toBe(testDate.toISOString());

      vi.useRealTimers();
    });

    it('accepts custom Date parameter and writes to localStorage', () => {
      const customDate = new Date('2025-03-01T08:30:00.000Z');

      const timestamp = markConversationRead(userId, conversationId, customDate);

      expect(timestamp).toBe(customDate.getTime());
      expect(localStorage.getItem(expectedKey)).toBe(customDate.toISOString());
    });
  });

  describe('roundtrip and isolation', () => {
    it('persists and retrieves read state correctly across functions', () => {
      const targetDate = new Date('2025-05-20T15:45:00.000Z');

      markConversationRead(userId, conversationId, targetDate);
      const readAt = getConversationReadAt(userId, conversationId);

      expect(readAt).toBe(targetDate.getTime());
    });

    it('isolates state per userId and conversationId', () => {
      const date1 = new Date('2025-01-01T00:00:00.000Z');
      const date2 = new Date('2025-02-02T00:00:00.000Z');

      markConversationRead('user-1', 'conv-A', date1);
      markConversationRead('user-2', 'conv-A', date2);

      expect(getConversationReadAt('user-1', 'conv-A')).toBe(date1.getTime());
      expect(getConversationReadAt('user-2', 'conv-A')).toBe(date2.getTime());
      expect(getConversationReadAt('user-1', 'conv-B')).toBe(0);
    });
  });
});
