'use client';

import { Share2, Ban } from 'lucide-react';
import { AgenticSyncDot } from './AgenticSyncDot';
import { toast } from 'react-hot-toast';

interface AgenticMessageActionsProps {
  messageId: string;
  sessionId?: string | null;
  isPublic?: boolean;
  isGuest?: boolean;
  syncStatus?: 'pending' | 'synced' | 'error';
  accent: string;
  onShareChange?: (next: { isPublic: boolean; isGuest: boolean }) => void;
}

export function AgenticMessageActions({
  messageId,
  sessionId,
  isPublic,
  isGuest,
  syncStatus,
  accent,
  onShareChange}: AgenticMessageActionsProps) {
  const shared = isPublic === true || isGuest === true;

  const handleShareToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionId) {
      toast.error('Session not ready yet — try again in a moment.');
      return;
    }
    try {
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((r: { jwt?: string }) => r?.jwt || '').catch(() => undefined);
      const { toggleAgentConversationShareAction } = await import('@/lib/actions/agentic');
      const mode = shared ? 'make_private' : 'publish';
      const res = await toggleAgentConversationShareAction(
        { sessionId, messageId, mode },
        jwt,
      );
      const nextPublic = res.isPublic === true;
      const nextGuest = res.isGuest === true;
      onShareChange?.({ isPublic: nextPublic, isGuest: nextGuest });

      if (!shared && res.publicUrl) {
        try {
          await navigator.clipboard.writeText(String(res.publicUrl));
          toast.success('Reply link copied');
        } catch {
          toast.success('Reply is now public');
        }
      } else if (shared) {
        toast.success('Reply is private again');
      }

      const { AgenticSessionLocalStore } = await import('@/lib/agentic/session-local-store');
      await AgenticSessionLocalStore.patchMessage(sessionId, messageId, {
        isPublic: nextPublic,
        isGuest: nextGuest,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update sharing');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <AgenticSyncDot syncStatus={syncStatus} />
      <button
        type="button"
        title={shared ? 'Make private' : 'Share this message'}
        onClick={(e) => void handleShareToggle(e)}
        className="w-6 h-6 rounded-md flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition"
        style={shared ? { color: accent } : undefined}
      >
        {shared ? <Ban size={12} /> : <Share2 size={12} />}
      </button>
    </div>
  );
}
