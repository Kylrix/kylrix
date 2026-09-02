'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MomentsDrawer } from '@/components/connect/MomentsDrawer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

function ConnectHomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      openUnified('moment-composer');
    }
  }, [openUnified, searchParams]);

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white overflow-hidden">
      <MomentsDrawer onClose={() => router.push('/app')} />
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectHomeContent />
    </Suspense>
  );
}

