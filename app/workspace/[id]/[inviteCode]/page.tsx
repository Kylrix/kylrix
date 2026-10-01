'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { joinWorkspaceByInviteCodeSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';
import { useAuth } from '@/context/auth/AuthContext';
import { toast } from 'react-hot-toast';

/**
 * Workspace Invite Code entry point: /workspace/[id]/[inviteCode]
 * Auto-joins the authenticated user as a member with read & write access.
 */
export default function WorkspaceInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { open: openDrawer } = useUnifiedDrawer();
  const { setActiveWorkspaceId, registerSharedWorkspace, refreshWorkspaces } = useWorkspace();

  const id = (params?.id as string) || '';
  const inviteCode = (params?.inviteCode as string) || '';

  const [deniedInfo, setDeniedInfo] = useState<{
    message: string;
    isUnauthenticated?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!id || !inviteCode) {
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
            new Promise<null>((r) => setTimeout(() => r(null), 1200)),
          ]);
          jwt = res?.jwt;
        } catch {}

        if (!jwt && (!user || user.$id === 'guest')) {
          setDeniedInfo({
            message: 'Please sign in to join this workspace.',
            isUnauthenticated: true,
          });
          setLoading(false);
          return;
        }

        const res = await joinWorkspaceByInviteCodeSecure(id, inviteCode, jwt);

        if (res.success && res.workspace) {
          try {
            await registerSharedWorkspace({
              id: res.workspace.id,
              title: res.workspace.title,
              ownerId: res.workspace.ownerId,
              isPublic: res.workspace.isPublic,
            });
          } catch {}

          try {
            await refreshWorkspaces();
          } catch {}

          try {
            setActiveWorkspaceId(res.workspace.id);
          } catch {}

          toast.success(`Joined "${res.workspace.title}"!`);
          router.replace('/app');

          setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/workspace/')) {
              window.location.replace('/app');
            }
          }, 500);
          return;
        }

        setDeniedInfo({
          message: 'Invalid or expired invite link. Please ask the owner for a new invite link.',
        });
        setLoading(false);
      } catch (err: any) {
        console.error('[WorkspaceInvitePage] Error joining workspace:', err);
        setDeniedInfo({
          message: err?.message || 'Invalid or expired invite link. Please ask the owner for a new invite link.',
        });
        setLoading(false);
      }
    })();
  }, [id, inviteCode, user, setActiveWorkspaceId, registerSharedWorkspace, refreshWorkspaces, router]);

  const handleReturnToApp = () => {
    router.replace('/app');
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/workspace/')) {
        window.location.replace('/app');
      }
    }, 300);
  };

  const handleOpenLogin = () => {
    openDrawer('login');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0908] text-white select-none gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/10 border-t-[#6366F1]" />
        <p className="text-xs font-bold text-white/40 font-satoshi animate-pulse">
          Joining workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0908] p-4 text-white select-none font-satoshi">
      <div className="w-full max-w-md bg-[#161412] border-2 border-white/15 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#818CF8] shrink-0">
            {deniedInfo?.isUnauthenticated ? <LogIn size={22} /> : (deniedInfo?.message ? <Lock size={22} className="text-[#EC4899]" /> : <UserPlus size={22} />)}
          </div>
          <div>
            <h1 className="text-lg font-black font-clash text-white tracking-tight">
              {deniedInfo?.isUnauthenticated ? 'Authentication Required' : 'Workspace Invite'}
            </h1>
            <p className="text-xs text-white/40 font-bold">
              {deniedInfo?.isUnauthenticated ? 'Sign in to accept invite' : 'Kylrix Collaborative Workspace'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/10 space-y-2">
          <p className="text-xs font-semibold text-white/70 leading-relaxed m-0">
            {deniedInfo?.message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {deniedInfo?.isUnauthenticated ? (
            <button
              type="button"
              onClick={handleOpenLogin}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-extrabold text-xs bg-[#6366F1] hover:bg-[#5254D8] text-white transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] active:scale-[0.98] cursor-pointer"
            >
              <LogIn size={14} />
              <span>Sign In with Kylrix</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReturnToApp}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-extrabold text-xs bg-[#6366F1] hover:bg-[#5254D8] text-white transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] active:scale-[0.98] cursor-pointer"
            >
              <span>Return to Kylrix</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
