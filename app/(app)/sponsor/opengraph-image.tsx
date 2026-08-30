import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { getProductName } from '@/lib/config/product';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const productName = getProductName();
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: productName,
      eyebrow: 'Sponsor',
      title: `Sponsor ${productName}`,
      description:
        'Support open source development with crypto checkout, tips, and sponsor badges.',
      accent: 'rose',
      ownerLabel: 'Open Source',
      ownerName: productName,
      chips: ['Tips', 'Crypto', 'Sponsor Badges'],
    }),
    size
  );
}
