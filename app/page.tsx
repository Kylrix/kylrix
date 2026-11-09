'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let target = '/app';
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
      if (match?.[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (
            decoded &&
            decoded !== '/' &&
            decoded !== '/landing' &&
            !decoded.startsWith('/login') &&
            !decoded.startsWith('/connect')
          ) {
            target = decoded;
          }
        } catch {
          // fallback to /app
        }
      }
    }
    router.replace(target);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
    </div>
  );
}
