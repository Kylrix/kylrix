import { registerMarkdownTransform } from '@/lib/markdown/pipeline';

const IMG_PH = '@@KYLRIX_IMG_';
let lastImgs: string[] | null = null;

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  // explicit image extensions
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|#|$)/.test(lower)) return true;
  // google gstatic thumbnails like https://encrypted-tbn0.gstatic.com/images?q=tbn:...
  if (lower.includes('gstatic.com/images')) return true;
  if (lower.includes('googleusercontent.com')) return true;
  if (lower.includes('twimg.com')) return true;
  if (lower.includes('cloudinary.com')) return true;
  if (lower.includes('imgur.com')) return true;
  if (lower.includes('images.unsplash.com')) return true;
  // query hints tbn, image
  if (/[?&]q=tbn/.test(lower)) return true;
  return false;
}

function renderImageHtml(url: string): string {
  const escUrl = escapeAttr(url);
  // cute openbricks: opaque, rounded, no blur, instant preview with fallback
  return `<div class="kylrix-image-link" style="margin:12px 0;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);background:#161412;">` +
    `<img src="${escUrl}" alt="Image" loading="lazy" style="display:block;max-width:100%;width:100%;height:auto;max-height:520px;object-fit:contain;background:#0A0908;" onerror="this.style.display='none';var a=this.nextElementSibling;if(a)a.style.display='block';" />` +
    `<a href="${escUrl}" target="_blank" rel="noreferrer" style="display:none;padding:10px 12px;color:#6366F1;font-size:12px;word-break:break-all;background:#0A0908;">${escUrl}</a>` +
    `</div>`;
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

  // Bare image URLs — https://... not inside []() already
  text = text.replace(/(^|[\s(])((https?:\/\/[^\s<>"']+))/g, (m, pre: string, url: string) => {
    // trim trailing punctuation that is not part of url e.g. ) . , ]
    let clean = url;
    const trailMatch = clean.match(/([.,!?)}\]]+)$/);
    let trail = '';
    if (trailMatch) {
      // keep if url ends with image extension + punctuation? already trimmed above
      clean = clean.slice(0, -trailMatch[1].length);
      trail = trailMatch[1];
    }
    if (!isImageUrl(clean)) return m;
    const i = blocks.length;
    blocks.push(renderImageHtml(clean));
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
