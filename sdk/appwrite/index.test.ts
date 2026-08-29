import { describe, expect, it, vi } from 'vitest';
import { createProfilePreviewManager } from './index';

describe('appwrite helpers', () => {
  it('caches profile previews after the first fetch', async () => {
    const fetcher = vi.fn(async (fileId: string) => `preview:${fileId}`);
    const manager = createProfilePreviewManager(fetcher);

    await expect(manager.fetchProfilePreview('file-1')).resolves.toBe('preview:file-1');
    await expect(manager.fetchProfilePreview('file-1')).resolves.toBe('preview:file-1');

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(manager.getCachedProfilePreview('file-1')).toBe('preview:file-1');
  });
});
