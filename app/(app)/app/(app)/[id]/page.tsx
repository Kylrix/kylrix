import { redirect } from 'next/navigation';

/** Legacy /app/[id] → canonical /idea/[id] */
export default async function LegacyAppNoteRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const query = key ? `/${encodeURIComponent(key)}` : '';
  redirect(`/idea/${id}${query}`);
}
