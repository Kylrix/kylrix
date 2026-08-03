import { ImageResponse } from 'next/og';
import { events as eventApi } from '@/lib/kylrixflow';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let title = 'Scheduled Event';
  let description = 'Coordinate scheduled events, RSVPs, and live moments on Kylrix.';
  let dateText = '';
  let locationText = '';
  let ownerName = 'Kylrix';
  let ownerAvatarDataUrl: string | null = null;

  try {
    const event = await eventApi.get(eventId);
    if (event) {
      title = event.title?.trim() || 'Scheduled Event';
      if (event.description?.trim()) {
        description = event.description.trim();
      }
      if (event.startTime) {
        dateText = new Date(event.startTime).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      if (event.location?.trim()) {
        locationText = event.location.trim();
      }
      const ownerId = event.userId || (event as any).creatorId;
      if (ownerId) {
        const owner = await resolveOwnerForOg(ownerId);
        ownerName = owner.ownerName;
        ownerAvatarDataUrl = owner.ownerAvatarDataUrl;
      }
    }
  } catch (err) {
    console.error('[EventOGImage] Failed to fetch event:', err);
  }

  const chips = [dateText, locationText, 'Scheduled Event'].filter(Boolean);

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Event',
      eyebrow: 'Scheduled Event',
      title,
      description,
      accent: 'emerald',
      ownerName,
      ownerAvatarDataUrl,
      chips,
    }),
    {
      ...size,
    }
  );
}
