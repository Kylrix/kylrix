'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Send, Lock, MessageSquare, Check, Loader2 } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { ChatService } from '@/lib/services/chat';
import { peekChatsListMemory, peekThreadsListMemory, readChatsListLocal, readThreadsListLocal } from '@/lib/chat/local-chat-cache';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import type { PublicResourceType } from '@/lib/share/resource-types';
import toast from 'react-hot-toast';

type ShareObject = {
  id: string;
  title: string;
  kind: string;
  resourceType: PublicResourceType;
  isPublic?: boolean;
  isGuest?: boolean;
};

export function HangoutSharePanel({
  object,
  onClose,
}: {
  object: ShareObject;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const [, startTransition] = useTransition();
  const [secureChats, setSecureChats] = useState<any[]>(() => peekChatsListMemory());
  const [threads, setThreads] = useState<any[]>(() => peekThreadsListMemory());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const isUnlocked = ecosystemSecurity.status.isUnlocked;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (secureChats.length === 0) {
        const cached = await readChatsListLocal();
        if (!cancelled && cached.length) startTransition(() => setSecureChats(cached));
      }
      if (threads.length === 0) {
        const cached = await readThreadsListLocal();
        if (!cancelled && cached.length) startTransition(() => setThreads(cached));
      }
    })();
    return () => { cancelled = true; };
  }, [secureChats.length, threads.length]);

  const allTargets = useMemo(() => {
    const secure = secureChats.map((c: any) => ({
      id: c.$id || c.id,
      label: c.name || c.title || 'Chat',
      kind: 'secure' as const,
      raw: c,
      isEncrypted: !!c.isEncrypted,
      participants: c.participants || [],
    }));
    const discuss = threads.map((t: any) => ({
      id: t.$id || t.id,
      label: t.title || t.name || t.lastMessageText || 'Thread',
      kind: 'thread' as const,
      raw: t,
      isEncrypted: false,
      participants: t.participants || [],
    }));
    return [...secure, ...discuss];
  }, [secureChats, threads]);

  const toggle = (id: string, disabled?: boolean) => {
    if (disabled) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!user?.$id || selected.size === 0) return;
    setSending(true);
    try {
      // 1) Ensure object is shareable (isPublic+isGuest)
      if (!object.isPublic || !object.isGuest) {
        try {
          const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
          await toggleResourcePublicGuest({
            resourceType: object.resourceType,
            resourceId: object.id,
            mode: 'publish',
          });
        } catch (e) {
          console.warn('[HangoutShare] toggle public failed', e);
        }
      }
      // Build share URL
      let shareUrl = '';
      try {
        shareUrl = buildPublicResourceUrl(object.resourceType, object.id, {});
      } catch {
        shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${object.resourceType}/${object.id}` : '';
      }
      const messageText = `${object.title ? `${object.title}\n` : ''}${shareUrl}`.trim() + `\n\nShared ${object.kind}`;

      const targets = allTargets.filter(t => selected.has(t.id));
      for (const target of targets) {
        if (target.kind === 'secure') {
          // Secure hangout — member permission mapping handled server-side via ChatService
          await ChatService.sendMessage(target.id, user.$id, messageText, 'text' as any, [], undefined, {
            type: 'objectShare',
            objectKind: object.kind,
            objectId: object.id,
            title: object.title,
            url: shareUrl,
          } as any);
        } else {
          // Thread/discussion hangout — canonical threads substrate
          const { postThreadMessage } = await import('@/lib/actions/client-ops');
          await postThreadMessage({
            threadId: target.id,
            content: messageText,
          });
        }
      }
      toast.success(`Shared to ${targets.length} hangout${targets.length > 1 ? 's' : ''}`);
      onClose?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to share');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0">Send to hangout</p>
          <h2 className="text-sm font-black font-clash text-white m-0 mt-1 truncate max-w-[260px]">{object.title || 'Untitled'}</h2>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412]">✕</button>
      </div>

      <div className="px-5 py-3 border-b border-white/[0.06] bg-[#161412]">
        <p className="text-xs text-white/60 font-satoshi m-0">Select hangouts to share with. Secure hangouts are blurred when vault is locked.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
        {allTargets.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/40 font-satoshi">No hangouts found. Start a chat in Connect first.</div>
        ) : (
          allTargets.map(target => {
            const isSelected = selected.has(target.id);
            const isSecureLocked = target.kind === 'secure' && target.isEncrypted && !isUnlocked;
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => toggle(target.id, isSecureLocked)}
                disabled={isSecureLocked}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isSecureLocked
                    ? 'bg-[#161412] border-white/[0.04] opacity-40 blur-[0.5px] cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#1C1A18] border-[#F59E0B]/30'
                    : 'bg-[#161412] border-white/[0.06] hover:border-white/10 hover:bg-[#1C1A18]'
                }`}
              >
                <div className={`h-9 w-9 shrink-0 rounded-full overflow-hidden border border-white/[0.06] flex items-center justify-center ${isSecureLocked ? 'bg-[#0A0908]' : 'bg-[#0A0908]'}`}>
                  {target.kind === 'secure' ? (
                    <IdentityAvatar
                      userId={target.participants?.find((p: string) => p !== user?.$id) || undefined}
                      size={36}
                      fallback={(target.label || '?').charAt(0).toUpperCase()}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-[#0A0908] border border-white/[0.06] grid place-items-center">
                      <MessageSquare size={14} className="text-white/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold font-satoshi text-white truncate m-0">{target.label}</p>
                    {target.isEncrypted ? <Lock size={11} className="text-[#F59E0B] shrink-0" /> : null}
                    {target.kind === 'thread' ? <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Thread</span> : null}
                  </div>
                  <p className="text-xs text-white/40 font-mono truncate m-0">
                    {target.kind === 'secure' ? `${target.participants?.length || 2} members` : 'Discussion'}
                    {isSecureLocked ? ' • vault locked' : ''}
                  </p>
                </div>
                <div className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#F59E0B] border-[#F59E0B] text-black' : 'border-white/15 text-transparent'}`}>
                  <Check size={12} strokeWidth={3} />
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#0A0908] p-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || selected.size === 0}
          className="w-full h-11 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2.5} />}
          {sending ? 'Sending...' : `Send to ${selected.size || ''} ${selected.size === 1 ? 'hangout' : selected.size ? 'hangouts' : 'hangout'}`.trim()}
        </button>
        <p className="text-[10px] text-white/30 text-center m-0 mt-2 font-mono">Toggles public sharing if needed • sends without opening Connect</p>
      </div>
    </div>
  );
}
