import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getDevMode, setDevMode, syncDevModeFromPrefs, useDevMode } from './dev-mode';
import { account } from '@/lib/appwrite/client';

// @ts-expect-error IS_REACT_ACT_ENVIRONMENT flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/appwrite/client', () => ({
  account: {
    getPrefs: vi.fn(),
    updatePrefs: vi.fn(),
  },
}));

/** Helper to render and test React hooks without external dependencies */
function renderDevModeHook() {
  const result: { current: ReturnType<typeof useDevMode> | null } = { current: null };

  function TestComponent() {
    result.current = useDevMode();
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    result: result as { current: ReturnType<typeof useDevMode> },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

describe('lib/dev-mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getDevMode', () => {
    it('returns false when window is undefined (SSR)', () => {
      const originalWindow = global.window;
      // @ts-expect-error simulating SSR
      delete global.window;

      try {
        expect(getDevMode()).toBe(false);
      } finally {
        global.window = originalWindow;
      }
    });

    it('returns true when localStorage value is "true"', () => {
      localStorage.setItem('kylrix:dev_mode', 'true');
      expect(getDevMode()).toBe(true);
    });

    it('returns false when localStorage value is "false", empty, or invalid', () => {
      localStorage.setItem('kylrix:dev_mode', 'false');
      expect(getDevMode()).toBe(false);

      localStorage.setItem('kylrix:dev_mode', '');
      expect(getDevMode()).toBe(false);

      localStorage.setItem('kylrix:dev_mode', '1');
      expect(getDevMode()).toBe(false);
    });

    it('returns false when localStorage is empty', () => {
      expect(getDevMode()).toBe(false);
    });

    it('returns false gracefully when localStorage.getItem throws an error', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      expect(getDevMode()).toBe(false);

      getItemSpy.mockRestore();
    });
  });

  describe('setDevMode', () => {
    it('sets localStorage, dispatches dev mode event, and syncs with account prefs', async () => {
      (account.getPrefs as any).mockResolvedValue({ theme: 'dark' });
      (account.updatePrefs as any).mockResolvedValue({});

      const listener = vi.fn();
      window.addEventListener('kylrix:dev_mode_change', listener);

      await setDevMode(true);

      expect(localStorage.getItem('kylrix:dev_mode')).toBe('true');
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe(true);

      expect(account.getPrefs).toHaveBeenCalledTimes(1);
      expect(account.updatePrefs).toHaveBeenCalledWith({ theme: 'dark', devMode: true });

      window.removeEventListener('kylrix:dev_mode_change', listener);
    });

    it('handles null/undefined prefs gracefully when syncing account prefs', async () => {
      (account.getPrefs as any).mockResolvedValue(null);
      (account.updatePrefs as any).mockResolvedValue({});

      await setDevMode(false);

      expect(localStorage.getItem('kylrix:dev_mode')).toBe('false');
      expect(account.updatePrefs).toHaveBeenCalledWith({ devMode: false });
    });

    it('catches and logs warning if account prefs sync fails without throwing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (account.getPrefs as any).mockRejectedValue(new Error('Network error'));

      await expect(setDevMode(true)).resolves.not.toThrow();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('syncDevModeFromPrefs', () => {
    it('fetches prefs, updates localStorage, dispatches event, and returns true when devMode is enabled', async () => {
      (account.getPrefs as any).mockResolvedValue({ devMode: true });

      const listener = vi.fn();
      window.addEventListener('kylrix:dev_mode_change', listener);

      const result = await syncDevModeFromPrefs();

      expect(result).toBe(true);
      expect(localStorage.getItem('kylrix:dev_mode')).toBe('true');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: true }));

      window.removeEventListener('kylrix:dev_mode_change', listener);
    });

    it('returns false when devMode in prefs is false or missing', async () => {
      (account.getPrefs as any).mockResolvedValue({ devMode: false });

      const result = await syncDevModeFromPrefs();

      expect(result).toBe(false);
      expect(localStorage.getItem('kylrix:dev_mode')).toBe('false');
    });

    it('falls back to getDevMode when account.getPrefs fails', async () => {
      localStorage.setItem('kylrix:dev_mode', 'true');
      (account.getPrefs as any).mockRejectedValue(new Error('Unauthorized'));

      const result = await syncDevModeFromPrefs();

      expect(result).toBe(true);
    });
  });

  describe('useDevMode', () => {
    it('initializes with devMode state from getDevMode', () => {
      localStorage.setItem('kylrix:dev_mode', 'true');

      const { result, unmount } = renderDevModeHook();

      expect(result.current.devMode).toBe(true);
      unmount();
    });

    it('listens for custom dev mode change events', () => {
      localStorage.setItem('kylrix:dev_mode', 'false');

      const { result, unmount } = renderDevModeHook();
      expect(result.current.devMode).toBe(false);

      act(() => {
        window.dispatchEvent(new CustomEvent('kylrix:dev_mode_change', { detail: true }));
      });

      expect(result.current.devMode).toBe(true);
      unmount();
    });

    it('toggles devMode when toggleDevMode is called', async () => {
      (account.getPrefs as any).mockResolvedValue({});
      (account.updatePrefs as any).mockResolvedValue({});

      const { result, unmount } = renderDevModeHook();

      await act(async () => {
        await result.current.toggleDevMode(true);
      });

      expect(result.current.devMode).toBe(true);
      expect(localStorage.getItem('kylrix:dev_mode')).toBe('true');
      unmount();
    });
  });
});
