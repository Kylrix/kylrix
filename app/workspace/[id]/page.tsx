'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ProjectsService } from '@/lib/appwrite/projects';

/**
 * Canonical workspace share link: /workspace/[id]
 * Sets the active workspace context to the visited id, registers in local shared workspaces, and redirects to /app.
 */
export default function WorkspaceSharePage() {
  const params = useParams();
  const router = useRouter();
  const { setActiveWorkspaceId, registerSharedWorkspace } = useWorkspace();
  const id = (params?.id as string) || '';
  const executedRef = useRef(false);

  useEffect(() => {
    if (!id) {
      router.replace('/app');
      return;
    }
    if (executedRef.current) return;
    executedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const proj = await ProjectsService.getProject(id).catch(() => null);
        if (!cancelled && proj) {
          await registerSharedWorkspace({
            id: proj.$id || id,
            title: proj.title || proj.name || 'Shared Workspace',
            ownerId: proj.ownerId || proj.userId,
            isPublic: proj.isPublic,
          });
        } else if (!cancelled) {
          await registerSharedWorkspace({ id });
        }
      } catch {
        if (!cancelled) {
          await registerSharedWorkspace({ id });
        }
      }

      if (!cancelled) {
        try {
          setActiveWorkspaceId(id);
        } catch {}
        router.replace('/app');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, setActiveWorkspaceId, registerSharedWorkspace, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
    </div>
  );
}
