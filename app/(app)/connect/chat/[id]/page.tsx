'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/** Legacy `/connect/chat/[id]` → canonical `/connect/chats/[id]`. */
function RedirectBody() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    const q = searchParams?.toString();
    router.replace(q ? `/connect/chats/${id}?${q}` : `/connect/chats/${id}`);
  }, [id, router, searchParams]);

  return (
    <div className="flex h-[40vh] items-center justify-center bg-[#000000]">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
    </div>
  );
}

export default function LegacyChatRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectBody />
    </Suspense>
  );
}
