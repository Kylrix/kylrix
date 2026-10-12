import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicGoalDataSecure } from '@/lib/actions/secure-ops';
import SharedGoalClient from '../SharedGoalClient';

/**
 * Public goal share: /goal/[id] or /goal/[id]/[dek]
 * DEK in path unlocks vault-locked goals without exposing the master key.
 */
export default async function SharedGoalPage({
  params,
}: {
  params: Promise<{ id: string; key?: string[] }>;
}) {
  const { id, key } = await params;
  const first = key?.[0] || '';
  if (first.startsWith('opengraph-image') || first.startsWith('twitter-image')) {
    notFound();
  }

  const goal = await getPublicGoalDataSecure(id).catch(() => null);
  return (
    <SharedGoalClient
      goalId={id}
      goal={goal}
      dekFragment={key?.join('/') || undefined}
    />
  );
}
