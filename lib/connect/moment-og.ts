/**
 * OG image generator for individual Connect moments (posts).
 * Fetches the moment + creator, then renders via the shared renderKylrixShareCard helper.
 */

import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const MOMENT_OG_SIZE = { width: 1200, height: 630 };

function collapseWs(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function trimMax(s: string, max: number) {
  const t = collapseWs(s);
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`;
}

/** Resolve the first image URL from a post's content / tags (for OG preview). */
function extractFirstImage(content: string, tags?: string[][]): string | null {
  // NIP-94 / imeta tags
  if (tags) {
    for (const tag of tags) {
      if (tag[0] === 'imeta' || tag[0] === 'image') {
        const urlEntry = tag.find((v) => v.startsWith('url '));
        if (urlEntry) return urlEntry.slice(4).trim();
        const direct = tag.find((v) => /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(v));
        if (direct) return direct;
      }
    }
  }
  // Inline URLs
  const match = content.match(/https?:\/\/[^\s,)]+\.(jpg|jpeg|png|webp|gif)(\?[^\s,)]*)?/i);
  return match ? match[0] : null;
}

/** Fetch a remote image and return as data-url for ImageResponse (avoids CORS in edge). */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

export async function createMomentOpenGraphImage(id: string): Promise<ImageResponse> {
  let title = 'Kylrix Connect';
  let description = 'Moments from the Kylrix social feed.';
  let ownerName = 'Kylrix';
  let ownerAvatarDataUrl: string | null = null;
  let previewImageDataUrl: string | null = null;

  try {
    // Handle nostr_ prefixed IDs (client-side routing artifact)
    const isNostr = id.startsWith('nostr_') || /^[0-9a-f]{64}$/i.test(id.replace(/^nostr_/, ''));
    const cleanId = id.replace(/^nostr_/, '').replace(/^eco_/, '');

    if (isNostr) {
      // For Nostr posts try to fetch from relays — lightweight REQ
      // We just render a generic Nostr card since relay access is async/unreliable in edge
      title = 'Nostr Post';
      description = 'View this Nostr note on Kylrix Connect';
      ownerName = 'Nostr';
    } else {
      const { SocialService } = await import('@/lib/services/social');
      const moment = await SocialService.getMomentById(cleanId).catch(() => null);
      if (moment) {
        const rawCaption = moment.caption || moment.content || '';
        const creatorId = moment.userId || moment.creatorId;
        if (creatorId) {
          const resolved = await resolveOwnerForOg(creatorId);
          ownerName = resolved.ownerName;
          ownerAvatarDataUrl = resolved.ownerAvatarDataUrl;
        }

        // Prioritise attached image or media URL
        const attachments = moment.attachments ? (
          typeof moment.attachments === 'string' ? JSON.parse(moment.attachments) : moment.attachments
        ) : null;
        const mediaUrl: string | null =
          (Array.isArray(attachments) && attachments[0]?.url) ||
          extractFirstImage(rawCaption, moment.tags) ||
          null;

        if (mediaUrl) {
          previewImageDataUrl = await fetchImageAsDataUrl(mediaUrl);
        }

        title = rawCaption
          ? trimMax(rawCaption, 72)
          : `Post by ${ownerName}`;
        description = rawCaption
          ? `${trimMax(rawCaption, 220)} · by ${ownerName} on Kylrix Connect`
          : `Moment by ${ownerName} on Kylrix Connect`;
      }
    }
  } catch (err) {
    console.error('[MomentOGImage] Failed:', err);
  }

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Connect',
      eyebrow: 'Moment',
      title,
      description,
      accent: 'amber',
      ownerName,
      ownerAvatarDataUrl,
      previewImageDataUrl,
    }),
    { ...MOMENT_OG_SIZE },
  );
}
