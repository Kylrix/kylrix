import type { Metadata } from 'next';
import { events as eventApi } from '@/lib/kylrixflow';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await eventApi.get(eventId);

    if (!event) {
      return buildOgMetadata({
        title: 'Event Not Found | Kylrix Flow',
        description: 'This event is private or does not exist.',
        imageUrl: `/events/${eventId}/opengraph-image`,
      });
    }

    const eventTitle = event.title?.trim() || 'Scheduled Event';
    const dateFormatted = event.startTime ? new Date(event.startTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) : '';
    const locSnippet = event.location ? ` · ${event.location}` : '';
    const descSnippet = event.description?.trim() ? `${event.description.trim().slice(0, 140)}... ` : '';

    const title = `${eventTitle} | Kylrix Event`;
    const description = `${descSnippet}${dateFormatted}${locSnippet}`;
    const previewImage = `/events/${eventId}/opengraph-image?v=${encodeURIComponent(
      event.$updatedAt || eventId
    )}`;

    return buildOgMetadata({
      title,
      description,
      imageUrl: previewImage,
    });
  } catch (_e) {
    return buildOgMetadata({
      title: 'Scheduled Event | Kylrix',
      description: 'Coordinate scheduled events, RSVPs, and live moments on Kylrix.',
      imageUrl: '/opengraph-image',
    });
  }
}

export default function EventPreviewLayout({
  children}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
