'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { resolveWorkspaceShareAccessSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';

/**
 * Canonical workspace share entry point: /workspace/[id]
 * Lazily verifies workspace accessibility (public first, then owner/collaborator access).
 * If access is granted: switches active workspace and routes to /app.
 * If access is denied: retains existing active workspace, alerts the user, and routes back to /app on confirmation.
 */
export default function WorkspaceSharePage() {
  const params = useParams();
  const router = useRouter();
  const { setActiveWorkspaceId, registerSharedWorkspace } = useWorkspace();
  const id = (params?.id as string) || '';

  const [deniedInfo, setDeniedInfo] = useState<{
    ownerName: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!id) {
      router.replace('/app');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    void (async () => {
      try {
        let jwt: string | undefined = undefined;
        try {
          const res = await Promise.race([
            account.createJWT(),
            new Promise<null>((r) => setTimeout(() => r(null), 1000)),
          ]);
          jwt = res?.jwt;
        } catch {}

        const access = await resolveWorkspaceShareAccessSecure(id, jwt);

        if (access.success && access.workspace) {
          try {
            await registerSharedWorkspace({
              id: access.workspace.id,
              title: access.workspace.title,
              ownerId: access.workspace.ownerId,
              isPublic: access.workspace.isPublic,
            });
          } catch {}

          try {
            setActiveWorkspaceId(access.workspace.id);
          } catch {}

          router.replace('/app');
          // Guaranteed fallback redirect if router transition delays
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/workspace/')) {
              window.location.replace('/app');
            }
          }, 500);
          return;
        }

        // Access denied
        setDeniedInfo({
          ownerName: access.ownerName || 'the workspace owner',
          message:
            access.message ||
            'No access to workspace. Ask the owner to make it public or add you to collaborators.',
        });
        setLoading(false);
      } catch (err) {
        console.error('[WorkspaceSharePage] Error resolving access:', err);
        setDeniedInfo({
          ownerName: 'the workspace owner',
          message:
            'No access to workspace. Ask the owner to make it public or add you to collaborators.',
        });
        setLoading(false);
      }
    })();
  }, [id, setActiveWorkspaceId, registerSharedWorkspace, router]);

  const handleReturnToApp = () => {
    router.replace('/app');
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/workspace/')) {
        window.location.replace('/app');
      }
    }, 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0908] text-white select-none gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/10 border-t-[#6366F1]" />
        <p className="text-xs font-bold text-white/40 font-satoshi animate-pulse">
          Opening workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908] p-4 text-white select-none">
      <div className="w-full max-w-md bg-[#161412] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/10 border border-[#EC4899]/25 flex items-center justify-center text-[#EC4899] shrink-0">
            <Lock size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black font-clash text-white tracking-tight">
              No Access to Workspace
            </h1>
            <p className="text-xs text-white/40 font-bold font-satoshi">
              Private Workspace
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2">
          <p className="text-xs font-semibold font-satoshi text-white/70 leading-relaxed">
            {deniedInfo?.message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReturnToApp}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-extrabold text-xs bg-[#6366F1] hover:bg-[#5254D8] text-white font-satoshi transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] active:scale-[0.98] cursor-pointer"
          >
            <span>OK</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
