'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from './(app)/app/landing/page';

export default function RootPage() {
  const router = useRouter();
  const [shouldStay, setShouldStay] = useState<boolean | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hasStay = hash.includes('stay') || search.includes('stay');

    if (hasStay) {
      setShouldStay(true);
    } else {
      // Redirect instantly to /app or last active route
      const lastRoute = typeof window !== 'undefined'
        ? document.cookie.split('; ').find(row => row.startsWith('kylrix_last_route='))?.split('=')[1]
        : null;
      const target = lastRoute ? decodeURIComponent(lastRoute) : '/app';
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

  return <LandingPage />;
}
