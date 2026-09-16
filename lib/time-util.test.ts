import { describe, it, expect } from 'vitest';
import { formatTime, addHours } from './time-util';

describe('time-util', () => {
  describe('formatTime', () => {
    it('formats valid Date object into string', () => {
      const d = new Date('2025-01-15T12:30:00Z');
      const formatted = formatTime(d);
      expect(typeof formatted).toBe('string');
      expect(formatted).toBeTruthy();
    });

    it('formats ISO string date input', () => {
      const formatted = formatTime('2025-05-20T08:00:00Z');
      expect(typeof formatted).toBe('string');
      expect(formatted).toBeTruthy();
    });

    it('formats timestamp number input', () => {
      const formatted = formatTime(1700000000000);
      expect(typeof formatted).toBe('string');
      expect(formatted).toBeTruthy();
    });

    it('returns empty string for invalid dates', () => {
      expect(formatTime('invalid-date-string')).toBe('');
      expect(formatTime(NaN)).toBe('');
    });
  });

  describe('addHours', () => {
    it('adds positive hours to a date', () => {
      const start = new Date('2025-01-01T10:00:00Z');
      const result = addHours(start, 5);
      expect(result.getUTCHours()).toBe(15);
    });

    it('subtracts negative hours from a date', () => {
      const start = new Date('2025-01-01T10:00:00Z');
      const result = addHours(start, -3);
      expect(result.getUTCHours()).toBe(7);
    });

    it('does not mutate original date object', () => {
      const start = new Date('2025-01-01T10:00:00Z');
      const originalMs = start.getTime();
      addHours(start, 2);
      expect(start.getTime()).toBe(originalMs);
    });
  });
});
