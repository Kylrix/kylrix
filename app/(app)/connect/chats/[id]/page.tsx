'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/** Legacy path detail → stay on /connect/chats with in-page selection. */
function RedirectBody() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id) {
      router.replace('/connect/chats');
      return;
    }
    const next = new URLSearchParams(searchParams?.toString() || '');
    next.set('c', id);
    router.replace(`/connect/chats?${next.toString()}`);
  }, [id, router, searchParams]);

  return (
    <div className="flex h-[40vh] items-center justify-center bg-[#000000]">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#F59E0B]" />
    </div>
  );
}

export default function ConnectChatIdRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectBody />
    </Suspense>
  );
}
