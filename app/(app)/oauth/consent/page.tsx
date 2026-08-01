import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ConsentScreen } from '@/components/oauth/ConsentScreen';

export const metadata: Metadata = {
  title: 'Allow access',
  robots: { index: false, follow: false },
};

export default function OAuthConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#0A0908] text-white/50 flex items-center justify-center text-sm font-satoshi">
          Loading…
        </div>
      }
    >
      <ConsentScreen />
    </Suspense>
  );
}
