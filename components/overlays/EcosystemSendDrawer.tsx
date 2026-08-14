'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { Send, Lock, MessageSquare, Check, Loader2, X, Search, Sparkles } from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/context/auth/AuthContext';
import { ChatService } from '@/lib/services/chat';
import { peekChatsListMemory, peekThreadsListMemory, readChatsListLocal, readThreadsListLocal } from '@/lib/chat/local-chat-cache';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import type { PublicResourceType } from '@/lib/share/resource-types';
import toast from 'react-hot-toast';

export interface EcosystemSendDrawerProps {
  isOpen?: boolean;
  onClose: () => void;
  resourceType: PublicResourceType;
  resourceId: string;
  resourceTitle?: string;
  kind?: string;
  isPublic?: boolean;
  isGuest?: boolean;
  projectId?: string;
  resolveShareUrl?: () => Promise<string>;
  onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void;
}

export function EcosystemSendDrawer({
  isOpen = true,
  onClose,
  resourceType,
  resourceId,
  resourceTitle,
  kind,
  isPublic,
  isGuest,
  projectId,
  resolveShareUrl,
  onUpdate,
}: EcosystemSendDrawerProps) {
  const { user } = useAuth();
  const [, startTransition] = useTransition();
  const [secureChats, setSecureChats] = useState<any[]>(() => peekChatsListMemory());
  const [threads, setThreads] = useState<any[]>(() => peekThreadsListMemory());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const isUnlocked = ecosystemSecurity.status.isUnlocked;

  const objectKind = kind || resourceType || 'item';
  const displayTitle = resourceTitle || 'Untitled Item';

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

  const filteredTargets = useMemo(() => {
    if (!searchQuery.trim()) return allTargets;
    const q = searchQuery.toLowerCase();
    return allTargets.filter((t) => t.label.toLowerCase().includes(q));
  }, [allTargets, searchQuery]);

  const toggle = (id: string, disabled?: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
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
      // 1) Ensure object is shareable (isPublic + isGuest)
      if (!isPublic || !isGuest) {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cacheKey = `share:${resourceType}:${resourceId}`;
          await LocalEngine.instantWrite(cacheKey, { isPublic: true, isGuest: true }, async () => {
            const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
            return toggleResourcePublicGuest({
              resourceType,
              resourceId,
              mode: 'publish',
              projectId,
            });
          });
          onUpdate?.({ isPublic: true, isGuest: true });
        } catch (e) {
          console.warn('[EcosystemSend] toggle public failed', e);
        }
      }

      // 2) Build share URL
      let shareUrl = '';
      if (resolveShareUrl) {
        try {
          shareUrl = await resolveShareUrl();
        } catch {
          shareUrl = '';
        }
      }
      if (!shareUrl) {
        try {
          shareUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });
        } catch {
          shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${resourceType}/${resourceId}` : '';
        }
      }

      const messageText = `${displayTitle ? `${displayTitle}\n` : ''}${shareUrl}`.trim() + `\n\nShared ${objectKind}`;

      const targets = allTargets.filter((t) => selected.has(t.id));
      for (const target of targets) {
        if (target.kind === 'secure') {
          await ChatService.sendMessage(
            target.id,
            user.$id,
            messageText,
            'text' as any,
            [],
            undefined,
            {
              type: 'objectShare',
              objectKind,
              objectId: resourceId,
              title: displayTitle,
              url: shareUrl,
            } as any,
          );
        } else {
          const { postThreadMessage } = await import('@/lib/actions/client-ops');
          await postThreadMessage({
            threadId: target.id,
            content: messageText,
          });
        }
      }

      toast.success(`Sent to ${targets.length} hangout${targets.length > 1 ? 's' : ''}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send item');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0908] text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-4 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono m-0 flex items-center gap-1.5">
            <Sparkles size={11} className="text-[#F59E0B]" />
            <span>Send to Hangout / Chat</span>
          </p>
          <h2 className="text-sm font-black font-clash text-white m-0 mt-1 truncate max-w-[260px]">
            {displayTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#161412] transition-colors"
          aria-label="Close send drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-[#161412] shrink-0">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats & hangouts..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#0A0908] border border-white/[0.06] text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F59E0B]/50 transition-colors"
          />
        </div>
      </div>

      {/* Chat & Hangout List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0">
        {filteredTargets.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/40 font-satoshi">
            {searchQuery ? 'No chats match your search.' : 'No hangouts found. Start a chat in Connect first.'}
          </div>
        ) : (
          filteredTargets.map((target) => {
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
                    ? 'bg-[#1C1A18] border-[#F59E0B]/40 ring-1 ring-[#F59E0B]/30'
                    : 'bg-[#161412] border-white/[0.06] hover:border-white/10 hover:bg-[#1C1A18]'
                }`}
              >
                <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden border border-white/[0.06] flex items-center justify-center bg-[#0A0908]">
                  {target.kind === 'secure' ? (
                    <IdentityAvatar
                      userId={target.participants?.find((p: string) => p !== user?.$id) || undefined}
                      size={36}
                      fallback={(target.label || '?').charAt(0).toUpperCase()}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-[#0A0908] grid place-items-center">
                      <MessageSquare size={14} className="text-white/60" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold font-satoshi text-white truncate m-0">
                      {target.label}
                    </p>
                    {target.isEncrypted ? (
                      <Lock size={11} className="text-[#F59E0B] shrink-0" />
                    ) : null}
                    {target.kind === 'thread' ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 font-mono">
                        Thread
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-white/40 font-mono truncate m-0">
                    {target.kind === 'secure' ? `${target.participants?.length || 2} members` : 'Discussion'}
                    {isSecureLocked ? ' • vault locked' : ''}
                  </p>
                </div>

                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#F59E0B] border-[#F59E0B] text-black'
                      : 'border-white/20 text-transparent'
                  }`}
                >
                  <Check size={11} strokeWidth={3} />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0A0908] p-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || selected.size === 0}
          className="w-full h-11 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={2.5} />}
          <span>
            {sending
              ? 'Sending...'
              : `Send to ${selected.size || ''} ${selected.size === 1 ? 'recipient' : selected.size ? 'recipients' : 'recipient'}`.trim()}
          </span>
        </button>
        <p className="text-[10px] text-white/30 text-center m-0 mt-2 font-mono">
          Direct local sync • Sends without opening /connect/chats
        </p>
      </div>
    </div>
  );
}
