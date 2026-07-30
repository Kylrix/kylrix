import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix',
      eyebrow: 'The agentic workspace',
      title: 'Kylrix',
      description: 'The agentic workspace that 10x the productivity of high agency builders.',
      accent: 'indigo',
      ownerLabel: 'Built for',
      ownerName: 'High agency builders',
      chips: ['Notes', 'Vault', 'Flow', 'Projects', 'Agents'],
      footerNote: 'A pitch-black workspace where your tools, secrets, projects, and autonomous agents move as one.',
    }),
    size
  );
}
