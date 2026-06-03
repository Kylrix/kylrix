'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { getLastEcosystemRoute } from '@/lib/ecosystem/state-tracker';
import { getKylrixPulse } from '@/lib/appwrite';
import LandingPage from '@/app/(app)/note/landing/page';

export default function RootLanding() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [stayActive, setStayActive] = useState(false);

  useEffect(() => {
    // Check if stay parameter is specified to skip landing redirects
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('stay')) {
      setStayActive(true);
      return;
    }

    // AGGRESSIVE OPTIMIZATION FAST-PATH:
    // Avoid blocking on slow AuthContext iframe/network checks if we can determine state synchronously.
    const pulse = getKylrixPulse();
    const hasCachedUser = typeof window !== 'undefined' && !!localStorage.getItem('kylrix_flow_current_user_v2');
    const isMaybeAuthenticated = !!pulse || hasCachedUser;

    const performRedirect = () => {
      if (!isMaybeAuthenticated) {
        router.replace('/send');
      } else {
        const lastState = getLastEcosystemRoute();
        if (lastState && lastState.path && !lastState.path.startsWith('/send') && lastState.path !== '/') {
          router.replace(lastState.path);
        } else {
          router.replace('/connect/chats'); // Default fallback for authenticated
        }
      }
    };

    // Use a zero timeout to ensure Next.js router is ready and mounting is complete
    const timeoutId = setTimeout(performRedirect, 0);

    return () => clearTimeout(timeoutId);
  }, [router]);

  if (stayActive) {
    return <LandingPage />;
  }

  return null;
}
