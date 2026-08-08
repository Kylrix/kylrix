'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function LegacyWorkspaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.projectId as string) || '';

  useEffect(() => {
    if (projectId) router.replace(`/workspace/${projectId}`);
    else router.replace('/app');
  }, [projectId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
    </div>
  );
}
