import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { markSudoActive, resetSudo, isSudoActive } from './sudo-mode';

describe('sudo-mode', () => {
  beforeEach(() => {
    resetSudo();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetSudo();
    vi.useRealTimers();
  });

  it('is inactive by default', () => {
    expect(isSudoActive()).toBe(false);
  });

  it('becomes active after calling markSudoActive', () => {
    markSudoActive();
    expect(isSudoActive()).toBe(true);
  });

  it('remains active within the 5 minute window', () => {
    markSudoActive();
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    expect(isSudoActive()).toBe(true);
  });

  it('expires after 5 minutes of inactivity', () => {
    markSudoActive();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 minutes + 1 ms
    expect(isSudoActive()).toBe(false);
  });

  it('resets immediately when resetSudo is called', () => {
    markSudoActive();
    expect(isSudoActive()).toBe(true);
    resetSudo();
    expect(isSudoActive()).toBe(false);
  });
});
