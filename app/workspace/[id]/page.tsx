'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * Canonical workspace share link: /workspace/[id]
 * Sets the active workspace context to the visited id and redirects to /app.
 * The heavy project-detail surface under /workspaces is deprecated.
 */
export default function WorkspaceSharePage() {
  const params = useParams();
  const router = useRouter();
  const { setActiveWorkspaceId } = useWorkspace();
  const id = (params?.id as string) || '';

  useEffect(() => {
    if (!id) {
      router.replace('/app');
      return;
    }
    try {
      setActiveWorkspaceId(id);
    } catch {
      /* no-op */
    }
    router.replace('/app');
  }, [id, setActiveWorkspaceId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
    </div>
  );
}
