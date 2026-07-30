import { redirect } from 'next/navigation';

/** Legacy share URL — canonical is /goal/[id]. */
export default async function LegacyFlowGoalRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/goal/${id}`);
}
