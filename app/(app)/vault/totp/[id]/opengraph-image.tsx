import { ImageResponse } from 'next/og';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ temp?: string }>;
}) {
  const searchParams = (await props.searchParams) || {};
  const isTemp = searchParams.temp === '1';

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Vault',
      eyebrow: isTemp ? 'Temporary TOTP code' : 'Shared TOTP secret',
      title: isTemp ? 'One-time authenticator code' : 'Authenticator secret handoff',
      description: isTemp
        ? 'A one-time time-based code was shared with you through Kylrix Vault. It expires soon.'
        : 'A TOTP authenticator secret was shared with you through Kylrix Vault.',
      accent: isTemp ? 'rose' : 'amber',
      ownerName: 'Kylrix Vault',
      chips: isTemp ? ['Expires soon', 'Time-based code'] : ['Authenticator', 'Secure handoff'],
    }),
    size
  );
}
