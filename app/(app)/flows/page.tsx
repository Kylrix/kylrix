'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { FlowsDrawer } from '@/components/flows/FlowsDrawer';

function FlowsHomeContent() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white overflow-hidden">
      <FlowsDrawer onClose={() => router.push('/app')} />
    </div>
  );
}

export default function FlowsPage() {
  return (
    <Suspense fallback={null}>
      <FlowsHomeContent />
    </Suspense>
  );
}
