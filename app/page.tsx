'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';

export default function RootPage() {
  const router = useRouter();
  const [shouldStay, setShouldStay] = useState<boolean | null>(null);

  useEffect(() => {
    const isSelfHosted = isSelfHostedDeployment();
    const hash = window.location.hash;
    const search = window.location.search;
    const hasStay = !isSelfHosted && (hash.includes('stay') || search.includes('stay'));

    if (hasStay) {
      setShouldStay(true);
    } else {
      const lastRoute = document.cookie
        .split('; ')
        .find((row) => row.startsWith('kylrix_last_route='))
        ?.split('=')[1];
      const target = (lastRoute && decodeURIComponent(lastRoute) !== '/') ? decodeURIComponent(lastRoute) : '/app';
      router.replace(target);
    }
  }, [router]);

  if (shouldStay === null) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0908] text-[#F5F3EF] flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-clash text-4xl font-black tracking-tight">Kylrix</h1>
      <p className="text-[#9B9691] text-sm max-w-sm text-center">
        Secure ideas, goals, and workspaces — open the app to continue.
      </p>
      <button
        type="button"
        onClick={() => router.push('/app')}
        className="rounded-xl bg-[#A855F7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9333EA]"
      >
        Open app
      </button>
    </div>
  );
}
