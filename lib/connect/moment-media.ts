/**
 * Extract image URLs from post body (common on Nostr) and return cleaned text.
 */
const EXT_IMAGE =
  /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|bmp)(?:\?[^\s<>"']*)?/gi;

/** CDNs that often omit extensions in the path */
const CDN_IMAGE =
  /https?:\/\/(?:i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|void\.cat\/d\/|image\.nostr\.build\/|media\.tenor\.com|pbs\.twimg\.com|cdn\.discordapp\.com\/attachments)[^\s<>"']*/gi;

export function extractPostImages(content: string): { text: string; images: string[] } {
  if (!content) return { text: '', images: [] };

  const found: string[] = [];
  const seen = new Set<string>();

  const collect = (re: RegExp) => {
    const matches = content.match(re) || [];
    for (const raw of matches) {
      const url = raw.replace(/[),.;!?]+$/, '');
      if (seen.has(url)) continue;
      seen.add(url);
      found.push(url);
    }
  };

  collect(EXT_IMAGE);
  collect(CDN_IMAGE);

  let text = content;
  for (const url of found) {
    text = text.split(url).join(' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  return { text, images: found.slice(0, 4) };
}

/** Feed card body preview length before ellipsis */
export const MOMENT_PREVIEW_CHARS = 180;

export function truncateMomentBody(text: string, max = MOMENT_PREVIEW_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
