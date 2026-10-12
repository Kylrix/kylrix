'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkspacesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
    </div>
  );
}
