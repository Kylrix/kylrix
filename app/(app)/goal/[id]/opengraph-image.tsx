import { ImageResponse } from 'next/og';
import { getPublicGoalDataSecure } from '@/lib/actions/secure-ops';
import { renderKylrixShareCard } from '@/lib/og/share-card';
import { resolveOwnerForOg } from '@/lib/og/resolve-avatar';

export const runtime = 'nodejs';
export const size = {
  width: 1200,
  height: 630};
export const contentType = 'image/png';
export const alt = 'Shared Goal';

export default async function Image({
  params}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await getPublicGoalDataSecure(id);
  const owner = await resolveOwnerForOg(goal?.userId);

  const title = goal?.title || 'Shared Goal';
  const description = goal?.description || 'Track deliverables and milestones.';
  const status = goal?.status || 'todo';
  const priority = goal?.priority || 'medium';

  return new ImageResponse(
    renderKylrixShareCard({
      productLabel: 'Kylrix Flow',
      eyebrow: 'Shared goal',
      title,
      description,
      accent: 'violet',
      ownerName: owner.ownerName,
      ownerAvatarDataUrl: owner.ownerAvatarDataUrl,
      chips: [status, priority]}),
    {
      ...size}
  );
}
