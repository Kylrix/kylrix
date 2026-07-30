import { validatePublicTotpAccess } from '@/lib/appwrite/vault';
import SharedTotpClient from '../../../SharedTotpClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildOgMetadata } from '@/lib/og/share-card';

/**
 * Shared TOTP page.
 *
 * URL patterns:
 *  /vault/totp/[id]                  → seed share, no DEK (shows placeholder)
 *  /vault/totp/[id]/[dekBase64]      → seed share with DEK → live TOTP
 *  /vault/totp/[id]/temp/[b64params] → 90-second temp token (no decryption)
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}): Promise<Metadata> {
  try {
    const { id, key } = await params;
    const isTemp = key?.[0] === 'temp';
    const previewImage = `https://www.kylrix.space/vault/totp/${id}/opengraph-image${isTemp ? '?temp=1' : ''}`;

    const displayTitle = isTemp
      ? 'Temporary TOTP Code · Kylrix'
      : 'Shared TOTP Secret · Kylrix';
    const displayDesc = isTemp
      ? 'A one-time time-based code was shared with you via Kylrix Vault. It expires soon.'
      : 'Someone shared a TOTP authenticator secret with you via Kylrix Vault.';

    return buildOgMetadata({ title: displayTitle, description: displayDesc, imageUrl: previewImage });
  } catch {
    return buildOgMetadata({
      title: 'Shared TOTP · Kylrix',
      description: 'View a shared TOTP authenticator code securely.',
      imageUrl: 'https://www.kylrix.space/opengraph-image',
    });
  }
}

export default async function SharedTotpPage({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}) {
  const { id, key } = await params;

  // Server-side validation: if not public and not temp parameters, load to verify
  const isTemp = key?.[0] === 'temp';
  let rawTotp = null;

  if (!isTemp) {
    const totp = await validatePublicTotpAccess(id);
    if (!totp) return notFound();
    rawTotp = JSON.parse(JSON.stringify(totp));
  }

  return (
    <SharedTotpClient
      totpId={id}
      keySegments={key}
      rawTotp={rawTotp}
    />
  );
}
