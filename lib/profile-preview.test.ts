import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchProfilePreview,
  getCachedProfilePreview,
  invalidateProfilePreview,
} from './profile-preview';
import { getProfilePicturePreview, getKylrixPulse, setKylrixPulse } from '@/lib/appwrite';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getProfilePicturePreviewSecure } from '@/lib/actions/secure-ops';

vi.mock('@/lib/appwrite', () => ({
  getProfilePicturePreview: vi.fn(),
  getKylrixPulse: vi.fn(),
  setKylrixPulse: vi.fn(),
}));

vi.mock('@/lib/services/LocalEngine', () => ({
  LocalEngine: {
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
  },
}));

vi.mock('@/lib/actions/secure-ops', () => ({
  getProfilePicturePreviewSecure: vi.fn(),
}));

describe('lib/profile-preview', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    globalThis.fetch = vi.fn();

    vi.mocked(getKylrixPulse).mockReturnValue(null);
    vi.mocked(LocalEngine.cacheGet).mockResolvedValue(null);
    vi.mocked(LocalEngine.cacheSet).mockResolvedValue(undefined as any);
    vi.mocked(getProfilePicturePreviewSecure).mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    invalidateProfilePreview('test-file-1');
    invalidateProfilePreview('test-file-2');
    invalidateProfilePreview('pulse-user-id');
    invalidateProfilePreview('error-file-id');
    invalidateProfilePreview('data-file-id');
    invalidateProfilePreview('http-file-id');
    invalidateProfilePreview('file-inv');
  });

  describe('fetchProfilePreview', () => {
    it('returns null when fileId is falsy (undefined, null, or empty string)', async () => {
      expect(await fetchProfilePreview(undefined)).toBeNull();
      expect(await fetchProfilePreview(null)).toBeNull();
      expect(await fetchProfilePreview('')).toBeNull();
    });

    it('returns cached value from memory previewCache if present', async () => {
      vi.mocked(getKylrixPulse).mockReturnValue({
        $id: 'user-1',
        name: 'User One',
        profilePicId: 'file-memory',
        avatarBase64: 'data:image/png;base64,cached_in_memory',
      });

      const firstCall = await fetchProfilePreview('file-memory');
      expect(firstCall).toBe('data:image/png;base64,cached_in_memory');

      vi.mocked(getKylrixPulse).mockReturnValue(null);
      const secondCall = await fetchProfilePreview('file-memory');
      expect(secondCall).toBe('data:image/png;base64,cached_in_memory');
      expect(LocalEngine.cacheGet).not.toHaveBeenCalled();
    });

    it('returns avatarBase64 from getKylrixPulse when fileId matches profilePicId or $id', async () => {
      vi.mocked(getKylrixPulse).mockReturnValue({
        $id: 'user-123',
        name: 'Test User',
        profilePicId: 'file-456',
        avatarBase64: 'data:image/png;base64,pulse_avatar',
      });

      const res = await fetchProfilePreview('file-456');
      expect(res).toBe('data:image/png;base64,pulse_avatar');
      expect(getCachedProfilePreview('file-456')).toBe('data:image/png;base64,pulse_avatar');
    });

    it('returns avatarBase64 from getKylrixPulse when fileId matches pulse $id', async () => {
      vi.mocked(getKylrixPulse).mockReturnValue({
        $id: 'pulse-user-id',
        name: 'Pulse User',
        avatarBase64: 'data:image/png;base64,pulse_by_id',
      });

      const res = await fetchProfilePreview('pulse-user-id');
      expect(res).toBe('data:image/png;base64,pulse_by_id');
    });

    it('returns cached avatar from LocalEngine if memory/pulse missing', async () => {
      vi.mocked(LocalEngine.cacheGet).mockResolvedValue('data:image/png;base64,local_engine_avatar');

      const res = await fetchProfilePreview('local-file-id');
      expect(res).toBe('data:image/png;base64,local_engine_avatar');
      expect(LocalEngine.cacheGet).toHaveBeenCalledWith('avatar:local-file-id');
      expect(getCachedProfilePreview('local-file-id')).toBe('data:image/png;base64,local_engine_avatar');
    });

    it('handles LocalEngine.cacheGet rejection gracefully and falls through to URL preview generation', async () => {
      vi.mocked(LocalEngine.cacheGet).mockRejectedValue(new Error('IndexedDB error'));
      vi.mocked(getProfilePicturePreview).mockReturnValue({
        toString: () => 'data:image/png;base64,valid_data_uri',
      } as any);

      (globalThis.fetch as any).mockResolvedValue({ ok: true });

      const res = await fetchProfilePreview('file-with-localengine-error');
      expect(res).toBe('data:image/png;base64,valid_data_uri');
    });

    describe('error paths in URL preview generation (line 68)', () => {
      it('returns null when getProfilePicturePreview returns null', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue(null as any);

        const res = await fetchProfilePreview('file-null-url');
        expect(res).toBeNull();
      });

      it('returns null when getProfilePicturePreview returns undefined (throws Failed to generate preview URL)', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue(undefined as any);

        const res = await fetchProfilePreview('file-undefined-url');
        expect(res).toBeNull();
      });

      it('returns null when getProfilePicturePreview throws an exception', async () => {
        vi.mocked(getProfilePicturePreview).mockImplementation(() => {
          throw new Error('Appwrite storage error');
        });

        const res = await fetchProfilePreview('file-throw-url');
        expect(res).toBeNull();
      });

      it('returns null when urlObj.toString() throws an exception', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => {
            throw new Error('toString failure');
          },
        } as any);

        const res = await fetchProfilePreview('file-tostring-error');
        expect(res).toBeNull();
      });
    });

    describe('accessibility & fallback logic', () => {
      it('processes data: URLs directly when HEAD fetch is ok', async () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => dataUrl,
        } as any);
        vi.mocked(getKylrixPulse).mockReturnValue({
          $id: 'data-file-id',
          name: 'User',
          profilePicId: 'data-file-id',
        });

        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        const res = await fetchProfilePreview('data-file-id');
        expect(res).toBe(dataUrl);

        // Wait microtasks for dynamic import LocalEngine background call
        await new Promise((r) => setTimeout(r, 50));
        expect(setKylrixPulse).toHaveBeenCalled();
        expect(LocalEngine.cacheSet).toHaveBeenCalledWith('avatar:data-file-id', dataUrl);
      });

      it('converts HTTP URLs to base64 in background when accessible', async () => {
        const httpUrl = 'https://example.com/avatar.png';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => httpUrl,
        } as any);

        const mockBlob = new Blob(['avatar_bytes'], { type: 'image/png' });
        (globalThis.fetch as any).mockImplementation((url: string, opts?: any) => {
          if (opts?.method === 'HEAD') {
            return Promise.resolve({ ok: true });
          }
          return Promise.resolve({
            blob: () => Promise.resolve(mockBlob),
          });
        });

        const res = await fetchProfilePreview('http-file-id');
        expect(res).toBe(httpUrl);

        await new Promise((r) => setTimeout(r, 50));
        expect(LocalEngine.cacheSet).toHaveBeenCalled();
      });

      it('handles background convertUrlToBase64 rejection gracefully without breaking return value', async () => {
        const httpUrl = 'https://example.com/failed-conversion.png';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => httpUrl,
        } as any);

        (globalThis.fetch as any).mockImplementation((url: string, opts?: any) => {
          if (opts?.method === 'HEAD') {
            return Promise.resolve({ ok: true });
          }
          return Promise.reject(new Error('Network error during blob fetch'));
        });

        const res = await fetchProfilePreview('http-fail-conversion-id');
        expect(res).toBe(httpUrl);

        await new Promise((r) => setTimeout(r, 50));
      });

      it('handles FileReader onerror failure inside convertUrlToBase64 gracefully', async () => {
        const httpUrl = 'https://example.com/filereader-error.png';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => httpUrl,
        } as any);

        const mockBlob = new Blob(['avatar_bytes'], { type: 'image/png' });
        (globalThis.fetch as any).mockImplementation((url: string, opts?: any) => {
          if (opts?.method === 'HEAD') {
            return Promise.resolve({ ok: true });
          }
          return Promise.resolve({
            blob: () => Promise.resolve(mockBlob),
          });
        });

        const OriginalFileReader = globalThis.FileReader;
        class MockFailingFileReader {
          onloadend: any = null;
          onerror: any = null;
          readAsDataURL() {
            setTimeout(() => {
              if (this.onerror) {
                this.onerror(new Error('FileReader read error'));
              }
            }, 5);
          }
        }
        globalThis.FileReader = MockFailingFileReader as any;

        try {
          const res = await fetchProfilePreview('filereader-fail-id');
          expect(res).toBe(httpUrl);
          await new Promise((r) => setTimeout(r, 50));
        } finally {
          globalThis.FileReader = OriginalFileReader;
        }
      });

      it('handles background LocalEngine.cacheSet rejection gracefully during data: URL save', async () => {
        const dataUrl = 'data:image/png;base64,data_uri_bg_error';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => dataUrl,
        } as any);

        (globalThis.fetch as any).mockResolvedValue({ ok: true });
        vi.mocked(LocalEngine.cacheSet).mockRejectedValue(new Error('Background IndexedDB write failure'));

        const res = await fetchProfilePreview('data-url-bg-error-id');
        expect(res).toBe(dataUrl);

        await new Promise((r) => setTimeout(r, 50));
      });

      it('handles background LocalEngine.cacheSet rejection gracefully during secure fallback', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => 'https://example.com/inaccessible.png',
        } as any);

        (globalThis.fetch as any).mockResolvedValue({ ok: false });
        vi.mocked(getProfilePicturePreviewSecure).mockResolvedValue('data:image/png;base64,secure_fallback_bg_err');
        vi.mocked(LocalEngine.cacheSet).mockRejectedValue(new Error('Secure fallback LocalEngine cacheSet error'));

        const res = await fetchProfilePreview('secure-bg-err-id');
        expect(res).toBe('data:image/png;base64,secure_fallback_bg_err');

        await new Promise((r) => setTimeout(r, 50));
      });

      it('falls back to getProfilePicturePreviewSecure when HEAD fetch fails or res.ok is false', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => 'https://example.com/inaccessible.png',
        } as any);

        (globalThis.fetch as any).mockResolvedValue({ ok: false });
        vi.mocked(getProfilePicturePreviewSecure).mockResolvedValue('data:image/png;base64,secure_fallback');

        const res = await fetchProfilePreview('inaccessible-id');
        expect(res).toBe('data:image/png;base64,secure_fallback');
        expect(getProfilePicturePreviewSecure).toHaveBeenCalledWith('inaccessible-id');
      });

      it('returns null when HEAD fetch fails and secure fallback returns null', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => 'https://example.com/inaccessible.png',
        } as any);

        (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));
        vi.mocked(getProfilePicturePreviewSecure).mockResolvedValue(null);

        const res = await fetchProfilePreview('secure-null-id');
        expect(res).toBeNull();
      });

      it('returns null when secure fallback rejects with an error', async () => {
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => 'https://example.com/inaccessible.png',
        } as any);

        (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));
        vi.mocked(getProfilePicturePreviewSecure).mockRejectedValue(new Error('Secure ops error'));

        const res = await fetchProfilePreview('secure-throw-id');
        expect(res).toBeNull();
      });
    });
  });

  describe('getCachedProfilePreview', () => {
    it('returns null when fileId is missing or falsy', () => {
      expect(getCachedProfilePreview(undefined)).toBeNull();
      expect(getCachedProfilePreview(null)).toBeNull();
      expect(getCachedProfilePreview('')).toBeNull();
    });

    it('returns pulse avatarBase64 if pulse matches fileId', () => {
      vi.mocked(getKylrixPulse).mockReturnValue({
        $id: 'user-cached',
        name: 'User Cached',
        profilePicId: 'file-cached-pulse',
        avatarBase64: 'data:image/png;base64,pulse_cached',
      });

      expect(getCachedProfilePreview('file-cached-pulse')).toBe('data:image/png;base64,pulse_cached');
    });

    it('returns undefined if not found in cache or pulse', () => {
      vi.mocked(getKylrixPulse).mockReturnValue(null);
      expect(getCachedProfilePreview('non-existent-file')).toBeUndefined();
    });
  });

  describe('invalidateProfilePreview', () => {
    it('does nothing when fileId is falsy', () => {
      invalidateProfilePreview(null);
      expect(setKylrixPulse).not.toHaveBeenCalled();
    });

    it('removes fileId from previewCache and resets pulse if matching current user', () => {
      vi.mocked(getKylrixPulse).mockReturnValue({
        $id: 'user-inv',
        name: 'User Inv',
        profilePicId: 'file-inv',
        avatarBase64: 'data:image/png;base64,something',
      });

      invalidateProfilePreview('file-inv');

      expect(setKylrixPulse).toHaveBeenCalledWith(
        { $id: 'user-inv', name: 'User Inv', prefs: { profilePicId: null } },
        null
      );

      // When pulse is reset to null/no avatarBase64, getCachedProfilePreview returns undefined
      vi.mocked(getKylrixPulse).mockReturnValue(null);
      expect(getCachedProfilePreview('file-inv')).toBeUndefined();
    });
  });

  describe('sessionStorage initialization & persistence exceptions', () => {
    it('loads existing valid cache from sessionStorage on module load', async () => {
      sessionStorage.setItem(
        'kylrix_avatar_cache_v2',
        JSON.stringify({
          'session-file-1': 'data:image/png;base64,session_loaded',
        })
      );

      vi.resetModules();
      const { getCachedProfilePreview: getCached } = await import('./profile-preview');
      expect(getCached('session-file-1')).toBe('data:image/png;base64,session_loaded');
    });

    it('handles non-object JSON (e.g., number or null) in sessionStorage gracefully during module load', async () => {
      sessionStorage.setItem('kylrix_avatar_cache_v2', '12345');

      vi.resetModules();
      const { getCachedProfilePreview: getCached } = await import('./profile-preview');
      expect(getCached('any-file')).toBeUndefined();
    });

    it('handles corrupted JSON in sessionStorage gracefully during module load', async () => {
      sessionStorage.setItem('kylrix_avatar_cache_v2', '{ invalid json ...');

      vi.resetModules();
      const { getCachedProfilePreview: getCached } = await import('./profile-preview');
      expect(getCached('any-file')).toBeUndefined();
    });

    it('handles sessionStorage.setItem QuotaExceededError or security exceptions gracefully when persistCache runs', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
      });

      try {
        const dataUrl = 'data:image/png;base64,valid_data_uri_quota_test';
        vi.mocked(getProfilePicturePreview).mockReturnValue({
          toString: () => dataUrl,
        } as any);

        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        const res = await fetchProfilePreview('file-quota-error');
        expect(res).toBe(dataUrl);
      } finally {
        setItemSpy.mockRestore();
      }
    });
  });
});
