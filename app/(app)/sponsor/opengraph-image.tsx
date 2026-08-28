import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Sponsor Kylrix';

export default async function Image() {
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix',
      eyebrow: 'Sponsor',
      title: 'Sponsor Kylrix',
      description:
        'Support open source development with crypto checkout, tips, and sponsor badges.',
      accent: 'rose',
      ownerLabel: 'Open Source',
      ownerName: 'Kylrix',
      chips: ['Tips', 'Crypto', 'Sponsor Badges'],
    }),
    size
  );
}
