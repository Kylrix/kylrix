/**
 * Nostr Media & Preview Substrate
 * NIP-92 (imeta tag), NIP-94 (file metadata), NIP-96 (HTTP upload), Blossom & Blurhash
 */

export interface NostrMediaAttachment {
  url: string;
  previewUrl?: string;
  thumbUrl?: string;
  blurhash?: string;
  dim?: string; // "1920x1080"
  aspectRatio?: number; // width / height
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
}

const EXT_IMAGE =
  /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|bmp)(?:\?[^\s<>"']*)?/gi;

const CDN_IMAGE =
  /https?:\/\/(?:i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|void\.cat\/d\/|image\.nostr\.build\/|nostr\.build\/i\/|media\.tenor\.com|pbs\.twimg\.com|cdn\.discordapp\.com\/attachments)[^\s<>"']*/gi;

/**
 * Extract media attachments from both NIP-92 / NIP-94 `imeta` tags and inlined body URLs.
 * Always prioritizes lightweight preview thumbnails (`thumb` or `image` tag) to save bandwidth and battery.
 */
export function extractPostMedia(
  content: string,
  tags?: string[][]
): {
  text: string;
  images: string[];
  attachments: NostrMediaAttachment[];
} {
  const attachments: NostrMediaAttachment[] = [];
  const seenUrls = new Set<string>();

  // 1. Process NIP-92 / NIP-94 `imeta` and `url` tags
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag[0] === 'imeta') {
        const item: Partial<NostrMediaAttachment> = {};
        for (let i = 1; i < tag.length; i++) {
          const entry = tag[i] || '';
          const spaceIdx = entry.indexOf(' ');
          if (spaceIdx > 0) {
            const key = entry.slice(0, spaceIdx).trim();
            const val = entry.slice(spaceIdx + 1).trim();
            if (key === 'url') item.url = val;
            else if (key === 'thumb') item.thumbUrl = val;
            else if (key === 'image') item.previewUrl = val;
            else if (key === 'blurhash') item.blurhash = val;
            else if (key === 'dim') {
              item.dim = val;
              const [w, h] = val.split('x').map(Number);
              if (w && h) item.aspectRatio = w / h;
            } else if (key === 'size') item.sizeBytes = Number(val) || undefined;
            else if (key === 'm') item.mimeType = val;
            else if (key === 'x') item.sha256 = val;
          }
        }
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          // Prefer preview/thumb URL for initial render
          attachments.push({
            url: item.url,
            thumbUrl: item.thumbUrl,
            previewUrl: item.previewUrl || item.thumbUrl,
            blurhash: item.blurhash,
            dim: item.dim,
            aspectRatio: item.aspectRatio,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
            sha256: item.sha256,
          });
        }
      }
    }
  }

  // 2. Extract inlined URLs from body
  const foundBodyUrls: string[] = [];
  const collect = (re: RegExp) => {
    const matches = (content || '').match(re) || [];
    for (const raw of matches) {
      const url = raw.replace(/[),.;!?]+$/, '');
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        foundBodyUrls.push(url);
        attachments.push({ url, previewUrl: url });
      }
    }
  };

  collect(EXT_IMAGE);
  collect(CDN_IMAGE);

  // Clean body text by stripping media URLs
  let text = content || '';
  for (const att of attachments) {
    text = text.split(att.url).join(' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  // Return preview URLs when available, fallback to full URLs
  const images = attachments.map((a) => a.previewUrl || a.thumbUrl || a.url).slice(0, 4);

  return { text, images, attachments: attachments.slice(0, 4) };
}

/** Legacy signature backward compatibility */
export function extractPostImages(
  content: string,
  tags?: string[][]
): { text: string; images: string[] } {
  const res = extractPostMedia(content, tags);
  return { text: res.text, images: res.images };
}

/** Feed card body preview length before ellipsis */
export const MOMENT_PREVIEW_CHARS = 180;

export function truncateMomentBody(text: string, max = MOMENT_PREVIEW_CHARS): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
