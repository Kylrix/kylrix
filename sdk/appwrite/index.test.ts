import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createProfilePreviewManager } from './index';

describe('appwrite helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('caches profile previews after the first fetch and supports sessionStorage', async () => {
    sessionStorage.setItem('kylrix_avatar_cache', JSON.stringify({ 'file-pre': 'prefilled' }));

    const fetcher = vi.fn(async (fileId: string) => `preview:${fileId}`);
    const manager = createProfilePreviewManager(fetcher);

    expect(manager.getCachedProfilePreview('file-pre')).toBe('prefilled');

    await expect(manager.fetchProfilePreview('file-1')).resolves.toBe('preview:file-1');
    await expect(manager.fetchProfilePreview('file-1')).resolves.toBe('preview:file-1');

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(manager.getCachedProfilePreview('file-1')).toBe('preview:file-1');

    manager.clearProfilePreviewCache();
    expect(manager.getCachedProfilePreview('file-1')).toBeUndefined();
  });

  it('handles empty fileId and fetcher errors gracefully', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('Network error');
    });
    const manager = createProfilePreviewManager(fetcher);

    await expect(manager.fetchProfilePreview('')).resolves.toBeNull();
    expect(manager.getCachedProfilePreview('')).toBeNull();
    expect(manager.getCachedProfilePreview(null)).toBeNull();

    await expect(manager.fetchProfilePreview('file-err')).resolves.toBeNull();
    expect(manager.getCachedProfilePreview('file-err')).toBeNull();
  });
});
