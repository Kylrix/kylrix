import { redirect } from 'next/navigation';

export default async function PairCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/pair?code=${encodeURIComponent(code)}`);
}
