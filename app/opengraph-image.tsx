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
      eyebrow: 'AI Agent Security & Memory',
      title: 'Zero-knowledge secrets and persistent memory for AI agents.',
      description: 'Let Claude Code, Cursor, and local agents use credentials without ever seeing plaintext secrets.',
      accent: 'indigo',
      ownerLabel: 'Architecture',
      ownerName: 'Argon2id + AES-256-GCM Vault & Local MCP',
      chips: ['Zero Leaks', 'Claude Code', 'Cursor', 'Argon2id', 'MCP Bridge', 'Local SQLite']}),
    size
  );
}
