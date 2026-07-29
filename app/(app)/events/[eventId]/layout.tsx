import type { Metadata } from 'next';
import { events as eventApi } from '@/lib/kylrixflow';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await eventApi.get(eventId);

    if (!event) {
      return {
        title: 'Event Not Found | Kylrix Flow',
        description: 'This event is private or does not exist.',
      };
    }

    const title = `${event.title} | Shared Event`;
    const description = event.description || `Date: ${new Date(event.startTime || '').toLocaleString()}`;
    const previewImage = `/flow/events/${eventId}/opengraph-image?v=${encodeURIComponent(
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
  } catch (e) {
    return {
      title: 'Shared Event | Kylrix Flow',
      description: 'Collaborate on events, scheduling, and high-velocity command centers.',
    };
  }
}

export default function EventPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
