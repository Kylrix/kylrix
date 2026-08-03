import type { Metadata } from 'next';
import { events as eventApi } from '@/lib/kylrixflow';

export async function generateMetadata({
  params}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await eventApi.get(eventId);

    if (!event) {
      return {
        title: 'Event Not Found | Kylrix Flow',
        description: 'This event is private or does not exist.'};
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

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [
          {
            url: previewImage,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [previewImage],
      },
    };
  } catch (_e) {
    return {
      title: 'Scheduled Event | Kylrix',
      description: 'Coordinate scheduled events, RSVPs, and live moments on Kylrix.',
    };
  }
}

export default function EventPreviewLayout({
  children}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
