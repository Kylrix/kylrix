import { registerMarkdownTransform } from '@/lib/markdown/pipeline';

const IMG_PH = '@@KYLRIX_IMG_';
let lastImgs: string[] | null = null;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|#|$)/.test(lower)) return true;
  // keep gstatic thumbnail query as image signal
  if (/[?&]q=tbn/.test(lower) && lower.includes('gstatic')) return true;
  return false;
}

function isPlainLinkUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname;
    if (!host.includes('.') || host.startsWith('.')) return false;
    if (host.length < 4) return false;
    // exclude already handled as image
    if (isImageUrl(url)) return false;
    // consider any http(s) or www. or domain.tld as link
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function linkPreviewCacheKey(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return `link_preview_${Math.abs(h)}_${url.length}`;
}

function renderImageHtml(url: string): string {
  const escUrl = escapeAttr(url);
  return `<div class="kylrix-image-link" style="margin:12px 0;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);background:#161412;">` +
    `<img src="${escUrl}" alt="Image" loading="lazy" style="display:block;max-width:100%;width:100%;height:auto;max-height:520px;object-fit:contain;background:#0A0908;" onerror="this.style.display='none';var a=this.nextElementSibling;if(a)a.style.display='block';" />` +
    `<a href="${escUrl}" target="_blank" rel="noreferrer" style="display:none;padding:10px 12px;color:#6366F1;font-size:12px;word-break:break-all;background:#0A0908;">${escUrl}</a>` +
    `</div>`;
}

function renderLinkPreviewHtml(url: string): string {
  const escUrl = escapeAttr(url);
  const escDisplay = escapeHtml(url);
  let host = '';
  try { host = new URL(url).hostname; } catch { host = url; }
  const escHost = escapeHtml(host);
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  return `<a href="${escUrl}" target="_blank" rel="noreferrer" class="kylrix-link-preview" data-link-preview="${escUrl}" style="display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px 14px;background:#161412;border:1px solid rgba(255,255,255,0.06);border-radius:14px;text-decoration:none;overflow:hidden;">` +
    `<img src="${escapeAttr(favicon)}" alt="" width="32" height="32" style="width:32px;height:32px;border-radius:8px;background:#0A0908;flex-shrink:0;object-fit:cover;" onerror="this.style.display='none'" />` +
    `<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">` +
    `<span style="color:white;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHost}</span>` +
    `<span style="color:rgba(255,255,255,0.55);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escDisplay}</span>` +
    `</span><span style="color:#6366F1;font-size:11px;font-weight:700;flex-shrink:0;">↗</span></a>`;
}

function cacheLinkPreview(url: string, kind: 'image' | 'link'): void {
  if (typeof window === 'undefined') return;
  const isImg = kind === 'image';
  const normalized = normalizeUrl(url);
  void (async () => {
    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const cacheKey = linkPreviewCacheKey(normalized);
      await LocalEngine.cacheSet(cacheKey, { url: normalized, kind, at: Date.now() }).catch(() => {});
      // surface in synced objects drawer: f_user_media cache
      try {
        const { getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
        const u = getCurrentUserSnapshot();
        const userId = u?.$id || 'guest';
        const mediaKey = `f_user_media_${userId}`;
        const existing = (await LocalEngine.cacheGet<any[]>(mediaKey).catch(() => null)) || [];
        const already = existing.some((r: any) => r.fileUrl === normalized || r.$id === cacheKey);
        if (!already) {
          const entry: any = {
            $id: cacheKey,
            name: isImg ? `Image: ${hostOf(normalized)}` : `Link: ${hostOf(normalized)}`,
            bucketId: 'link-previews',
            sizeOriginal: 0,
            mimeType: isImg ? 'image/*' : 'text/link-preview',
            createdAt: new Date().toISOString(),
            fileUrl: normalized,
          };
          await LocalEngine.cacheSet(mediaKey, [...existing, entry]).catch(() => {});
        }
      } catch {}
      // also store per-link key for note detail
      try {
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB().catch(() => null);
        if (db?.cache) {
          await db.cache.upsert({ id: cacheKey, data: { url: normalized, kind, at: Date.now() } }).catch(() => {});
        }
      } catch {}
    } catch {}
  })();
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export function extractImageLinkPlaceholders(md: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  let text = md;

  // Protect fenced code and inline code
  const codeFences: string[] = [];
  const CODE_PH = '@@IMG_CODE_';
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    const i = codeFences.length;
    codeFences.push(m);
    return `${CODE_PH}${i}@@`;
  });
  const inlineCodes: string[] = [];
  const INLINE_PH = '@@IMG_INLINE_';
  text = text.replace(/`[^`]+`/g, (m) => {
    const i = inlineCodes.length;
    inlineCodes.push(m);
    return `${INLINE_PH}${i}@@`;
  });

  // Protect existing markdown images ![alt](url) to avoid double handling
  const mdImages: string[] = [];
  const MDIMG_PH = '@@IMG_MDIMG_';
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (m) => {
    const i = mdImages.length;
    mdImages.push(m);
    return `${MDIMG_PH}${i}@@`;
  });

  // Honour Disable previews — only external link previews are gated
  const disablePreviews = typeof window !== 'undefined' ? Boolean((window as any).__KylrixDisableLinkPreviews) : false;

  // Bare URLs — https://, www., or domain.tld — not inside []() already
  // Handles both image and plain link previews; http-less like www.kylrix.space / kylrix.space/path
  const urlRegex = /(^|[\s(])((https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?))/gi;
  text = text.replace(urlRegex, (m, pre: string, rawUrl: string) => {
    // trim trailing punctuation that is not part of url e.g. ) . , ] 
    let clean = rawUrl;
    const trailMatch = clean.match(/([.,!?)}\]]+)$/);
    let trail = '';
    if (trailMatch) {
      clean = clean.slice(0, -trailMatch[1].length);
      trail = trailMatch[1];
    }
    // normalize for detection / rendering
    const normalized = normalizeUrl(clean);
    const isImg = isImageUrl(normalized);
    const isLink = isPlainLinkUrl(normalized);
    if (!isImg && !isLink) return m;
    if (disablePreviews) return m; // suppressed — keep plain text link via marked
    const i = blocks.length;
    if (isImg) {
      blocks.push(renderImageHtml(normalized));
      cacheLinkPreview(normalized, 'image');
    } else {
      blocks.push(renderLinkPreviewHtml(normalized));
      cacheLinkPreview(normalized, 'link');
    }
    return `${pre}${IMG_PH}${i}@@${trail}`;
  });

  // Restore markdown images, inline code, fences (in reverse)
  text = text.replace(new RegExp(`${MDIMG_PH}(\\d+)@@`, 'g'), (_m, idx: string) => mdImages[Number(idx)] || '');
  text = text.replace(new RegExp(`${INLINE_PH}(\\d+)@@`, 'g'), (_m, idx: string) => inlineCodes[Number(idx)] || '');
  text = text.replace(new RegExp(`${CODE_PH}(\\d+)@@`, 'g'), (_m, idx: string) => codeFences[Number(idx)] || '');

  return { text, blocks };
}

export function restoreImageLinkPlaceholders(html: string, blocks: string[]): string {
  let out = html;
  out = out.replace(new RegExp(`<p>\\s*${IMG_PH}(\\d+)@@\\s*<\\/p>`, 'g'), (_m, idx: string) => blocks[Number(idx)] || '');
  out = out.replace(new RegExp(`${IMG_PH}(\\d+)@@`, 'g'), (_m, idx: string) => blocks[Number(idx)] || '');
  return out;
}

export function registerImageLinkTransforms() {
  registerMarkdownTransform({
    id: 'image-link.extract',
    order: 23,
    phase: 'pre',
    apply: (input) => {
      const { text, blocks } = extractImageLinkPlaceholders(input);
      lastImgs = blocks;
      return text;
    },
  });
  registerMarkdownTransform({
    id: 'image-link.restore',
    order: 83,
    phase: 'post',
    apply: (input) => {
      if (!lastImgs || !lastImgs.length) return input;
      const blocks = lastImgs;
      lastImgs = null;
      return restoreImageLinkPlaceholders(input, blocks);
    },
  });
}
