'use client';

import { useEffect, useState } from 'react';
import LandingPage from '@/app/(app)/note/landing/page';

/**
 * ROOT LANDING PAGE
 * 
 * Note: Primary redirection is now handled at the Middleware layer for maximum snappiness.
 * This component only renders the marketing landing page if the user explicitly
 * requests to 'stay' (e.g. via /?stay=true).
 */
export default function RootLanding() {
  const [stayActive, setStayActive] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('stay')) {
      setStayActive(true);
    }
  }, []);

  if (stayActive) {
    return <LandingPage />;
  }

  // If we reached here without a redirect (should be rare due to Middleware),
  // return null to avoid a flash of unstyled landing content.
  return null;
}
