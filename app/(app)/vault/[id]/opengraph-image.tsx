import { ImageResponse } from 'next/og';
import { validatePublicVaultAccess } from '@/lib/appwrite/vault';
import { renderKylrixShareCard } from '@/lib/og/share-card';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const credential = await validatePublicVaultAccess(id).catch(() => null);

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Vault',
      eyebrow: credential ? 'Shared password' : 'Shared secret',
      title: credential ? 'Secure credential handoff' : 'Shared Secret',
      description: credential
        ? 'A password was shared with you through Kylrix Vault. Open the link to decrypt it inside the secure viewer.'
        : 'View this shared credential securely.',
      accent: 'amber',
      ownerName: 'Kylrix Vault',
      chips: ['Zero-knowledge', 'Secure handoff'],
    }),
    size
  );
}
