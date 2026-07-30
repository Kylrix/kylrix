import React from 'react';
import { validatePublicVaultAccess } from '@/lib/appwrite/vault';
import SharedVaultClient from '../../SharedVaultClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildOgMetadata } from '@/lib/og/share-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const credential = await validatePublicVaultAccess(id);
    const previewImage = `https://www.kylrix.space/vault/${id}/opengraph-image`;

    if (!credential) {
      return buildOgMetadata({
        title: 'Shared Secret · Kylrix',
        description: 'View this shared credential securely.',
        imageUrl: previewImage});
    }

    // name is encrypted, so we show a generic preview (safe: no secret data in OG)
    const displayTitle = 'Shared Password · Kylrix';
    const displayDesc =
      'Someone shared a password with you via Kylrix Vault. Open this link to view the credential.';

    return buildOgMetadata({ title: displayTitle, description: displayDesc, imageUrl: previewImage });
  } catch {
    return buildOgMetadata({
      title: 'Shared Secret · Kylrix',
      description: 'View shared credentials securely.',
      imageUrl: 'https://www.kylrix.space/opengraph-image'});
  }
}

export default async function SharedVaultPage({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}) {
  const { id, key } = await params;

  // Server-side validation: if not public, show not-found
  const credential = await validatePublicVaultAccess(id);
  if (!credential) return notFound();

  const dekFragment = key?.[0] ?? undefined;

  // Pass the raw encrypted credential to the client for client-side decryption
  return (
    <SharedVaultClient
      credentialId={id}
      dekFragment={dekFragment}
      rawCredential={JSON.parse(JSON.stringify(credential))}
    />
  );
}
