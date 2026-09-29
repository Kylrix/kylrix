import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { getProductName } from '@/lib/config/product';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const productName = getProductName();
  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: productName,
      eyebrow: 'Sovereign AI Workspace',
      title: 'The sovereign workspace for developers who run local AI agents.',
      description: 'Zero-leak vault, local notes, and native MCP bridge for Cursor and Claude Code.',
      accent: 'indigo',
      ownerLabel: 'Philosophy',
      ownerName: 'Every object → tool call → more context',
      chips: ['MCP', 'Cursor', 'Claude Code', 'Vault', 'Notes', 'Agents']}),
    size
  );
}
