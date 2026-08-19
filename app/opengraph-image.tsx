import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix',
      eyebrow: 'Build, ship and think',
      title: 'Build, ship and think in one living agentic workspace.',
      description: 'Your workflow becomes a living, scalable system that compounds daily leverage over time.',
      accent: 'indigo',
      ownerLabel: 'Philosophy',
      ownerName: 'Every object → tool call → more context',
      chips: ['Ideas', 'Flow', 'Vault', 'Workspaces', 'Connect', 'Agents']}),
    size
  );
}
