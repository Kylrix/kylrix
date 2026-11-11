import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSafeAvatarUrl, resolveProfileAvatarDataUrl, resolveMediaDataUrl } from './resolve-avatar';

describe('isSafeAvatarUrl - SSRF Guard', () => {
  it('allows safe public HTTPS URLs', () => {
    const url1 = isSafeAvatarUrl('https://example.com/avatar.png');
    expect(url1).not.toBeNull();
    expect(url1?.hostname).toBe('example.com');

    const url2 = isSafeAvatarUrl('https://avatars.githubusercontent.com/u/12345?v=4');
    expect(url2).not.toBeNull();
    expect(url2?.hostname).toBe('avatars.githubusercontent.com');
  });

  it('rejects non-HTTPS protocols', () => {
    expect(isSafeAvatarUrl('http://example.com/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('ftp://example.com/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('file:///etc/passwd')).toBeNull();
    expect(isSafeAvatarUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects localhost, .local, and .internal domains', () => {
    expect(isSafeAvatarUrl('https://localhost/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://app.localhost/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://server.local/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://api.internal/avatar.png')).toBeNull();
  });

  it('rejects private IPv4 addresses and link-local cloud metadata', () => {
    expect(isSafeAvatarUrl('https://127.0.0.1/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://127.0.1.1/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://169.254.169.254/latest/meta-data')).toBeNull();
    expect(isSafeAvatarUrl('https://10.0.0.1/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://172.16.0.1/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://172.31.255.255/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://192.168.1.1/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://0.0.0.0/avatar.png')).toBeNull();
  });

  it('rejects IPv6 loopback, link-local, and unique-local addresses', () => {
    expect(isSafeAvatarUrl('https://[::1]/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://[fe80::1]/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://[fc00::1]/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://[fd00::1]/avatar.png')).toBeNull();
  });

  it('rejects URLs with credentials or non-standard ports', () => {
    expect(isSafeAvatarUrl('https://admin:password@example.com/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://example.com:8080/avatar.png')).toBeNull();
    expect(isSafeAvatarUrl('https://example.com:3000/avatar.png')).toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(isSafeAvatarUrl('')).toBeNull();
    expect(isSafeAvatarUrl('not-a-url')).toBeNull();
  });
});

describe('resolveProfileAvatarDataUrl', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null for null, undefined, or empty fileId', async () => {
    expect(await resolveProfileAvatarDataUrl(null)).toBeNull();
    expect(await resolveProfileAvatarDataUrl(undefined)).toBeNull();
    expect(await resolveProfileAvatarDataUrl('')).toBeNull();
    expect(await resolveProfileAvatarDataUrl('   ')).toBeNull();
  });

  it('accepts valid raster data URLs', async () => {
    const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(await resolveProfileAvatarDataUrl(pngData)).toBe(pngData);

    const jpegData = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(await resolveProfileAvatarDataUrl(jpegData)).toBe(jpegData);
  });

  it('rejects dangerous or non-raster data URLs', async () => {
    expect(await resolveProfileAvatarDataUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeNull();
    expect(await resolveProfileAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeNull();
    expect(await resolveProfileAvatarDataUrl('data:application/json;base64,e30=')).toBeNull();
  });

  it('blocks SSRF attempts without fetching', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    expect(await resolveProfileAvatarDataUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(await resolveProfileAvatarDataUrl('https://127.0.0.1:8000/internal')).toBeNull();
    expect(await resolveProfileAvatarDataUrl('http://localhost:3000/avatar.png')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('successfully fetches and converts valid raster images from public HTTPS URLs', async () => {
    const fakeImageBuffer = Buffer.from('fake-png-bytes');
    const exactArrayBuffer = fakeImageBuffer.buffer.slice(
      fakeImageBuffer.byteOffset,
      fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength
    );
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'image/png',
        'content-length': String(fakeImageBuffer.byteLength),
      }),
      arrayBuffer: async () => exactArrayBuffer,
    });

    const result = await resolveProfileAvatarDataUrl('https://images.example.com/avatar.png');
    expect(result).toBe(`data:image/png;base64,${fakeImageBuffer.toString('base64')}`);
  });

  it('rejects responses with non-image Content-Type (prevents data exfiltration)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': '15',
      }),
      arrayBuffer: async () => Buffer.from('{"secret":"123"}').buffer,
    });

    const result = await resolveProfileAvatarDataUrl('https://api.example.com/leak');
    expect(result).toBeNull();
  });

  it('rejects responses exceeding MAX_AVATAR_BYTES', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'image/png',
        'content-length': String(10 * 1024 * 1024), // 10MB
      }),
      arrayBuffer: async () => Buffer.alloc(10 * 1024 * 1024).buffer,
    });

    const result = await resolveProfileAvatarDataUrl('https://images.example.com/huge.png');
    expect(result).toBeNull();
  });
});

describe('resolveMediaDataUrl', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('blocks SSRF and link-local cloud metadata attempts on media URLs', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    expect(await resolveMediaDataUrl('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(await resolveMediaDataUrl('https://169.254.169.254/latest/user-data')).toBeNull();
    expect(await resolveMediaDataUrl('https://127.0.0.1:8080/admin/dump')).toBeNull();
    expect(await resolveMediaDataUrl('https://localhost:3005/api/dev/logs')).toBeNull();
    expect(await resolveMediaDataUrl('https://10.0.0.5/internal.png')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('safely fetches and returns base64 data for legitimate media URLs', async () => {
    const fakeImageBuffer = Buffer.from('test-image-content');
    const exactArrayBuffer = fakeImageBuffer.buffer.slice(
      fakeImageBuffer.byteOffset,
      fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength
    );
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'image/webp',
        'content-length': String(fakeImageBuffer.byteLength),
      }),
      arrayBuffer: async () => exactArrayBuffer,
    });

    const result = await resolveMediaDataUrl('https://media.example.com/test.webp');
    expect(result).toBe(`data:image/webp;base64,${fakeImageBuffer.toString('base64')}`);
  });
});
