'use client';

import React, { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import {
  Send,
  Lock,
  MessageCircleMore,
  Check,
  Loader2,
  Plus,
  Search,
  Users,
  ChevronLeft,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { ChatService } from '@/lib/services/chat';
import {
  peekChatsListMemory,
  peekThreadsListMemory,
  readChatsListLocal,
  readThreadsListLocal,
  writeChatsListLocal,
} from '@/lib/chat/local-chat-cache';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import type { PublicResourceType } from '@/lib/share/resource-types';
import toast from 'react-hot-toast';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ChatCreateDrawer } from '@/components/objects/ChatCreateDrawer';
import {
  shouldRunEmptyEscapeHatch,
  markEmptyEscapeHatchRan,
} from '@/lib/sync/local-copy-sync';

export type ShareObject = {
  id: string;
  title: string;
  kind: string;
  resourceType: PublicResourceType;
  isPublic?: boolean;
  isGuest?: boolean;
};

export interface HangoutsDrawerProps {
  mode?: 'browse' | 'share';
  workspaceId?: string;
  workspaceTitle?: string;
  initialConversationId?: string;
  object?: ShareObject;
  onClose?: () => void;
}

export function HangoutsDrawer({
  mode = 'browse',
  workspaceId: propWorkspaceId,
  workspaceTitle: propWorkspaceTitle,
  initialConversationId,
  object,
  onClose,
}: HangoutsDrawerProps) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [, startTransition] = useTransition();

  const [secureChats, setSecureChats] = useState<any[]>(() => peekChatsListMemory());
  const [threads, setThreads] = useState<any[]>(() => peekThreadsListMemory());
  const [initialLoading, setInitialLoading] = useState<boolean>(() => !peekChatsListMemory().length && !peekThreadsListMemory().length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'group' | 'thread'>('all');
  const [showCreateChat, setShowCreateChat] = useState(false);

  // Active chat window inside drawer
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [loadingWorkspaceChat, setLoadingWorkspaceChat] = useState(false);
  const [wasDirectWorkspaceOpen, setWasDirectWorkspaceOpen] = useState(false);

  const isUnlocked = ecosystemSecurity.status.isUnlocked;

  const currentWorkspaceId = propWorkspaceId || (!activeWorkspace?.isPersonal ? activeWorkspace?.id : undefined);
  const currentWorkspaceTitle = propWorkspaceTitle || (!activeWorkspace?.isPersonal ? (activeWorkspace?.title || (activeWorkspace as any)?.name) : undefined);

  // Eagerly hydrate chats and threads from local copy + rate-limited remote escape hatch
  const refreshChats = useCallback(async () => {
    try {
      // 1. Eagerly read local copy from IndexedDB / RxDB
      const [cachedChats, cachedThreads] = await Promise.all([
        readChatsListLocal(),
        readThreadsListLocal(),
      ]);

      let hasAnyLocal = false;
      if (cachedChats?.length) {
        startTransition(() => setSecureChats(cachedChats));
        hasAnyLocal = true;
      }
      if (cachedThreads?.length) {
        startTransition(() => setThreads(cachedThreads));
        hasAnyLocal = true;
      }

      // 2. If local copy is empty or escape hatch allows, trigger remote fetch to replenish local copy
      const shouldEscape = shouldRunEmptyEscapeHatch('chats', user?.$id);

      if (user?.$id && (!hasAnyLocal || shouldEscape)) {
        try {
          const res = await ChatService.getConversations(user.$id, { forceRefresh: !hasAnyLocal });
          const rows = Array.isArray(res) ? res : res?.rows || [];
          if (rows.length) {
            startTransition(() => setSecureChats(rows));
            void writeChatsListLocal(rows);
          }
          markEmptyEscapeHatchRan('chats', user.$id);
        } catch (fetchErr) {
          console.warn('[HangoutsDrawer] Escape hatch fetch error:', fetchErr);
        }
      }
    } catch (err) {
      console.warn('[HangoutsDrawer] Local read error:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  // If opened in a real workspace without explicit initial conversation, spin up / fetch workspace discussion
  useEffect(() => {
    if (mode === 'browse' && currentWorkspaceId && !initialConversationId && !activeConvId && user?.$id) {
      let cancelled = false;
      setLoadingWorkspaceChat(true);
      void (async () => {
        try {
          const conv = await ChatService.getOrCreateWorkspaceConversation(
            currentWorkspaceId,
            currentWorkspaceTitle,
            user.$id,
          );
          if (!cancelled && conv?.$id) {
            startTransition(() => {
              setActiveConvId(conv.$id);
              setWasDirectWorkspaceOpen(true);
            });
          }
        } catch (err: any) {
          console.warn('[HangoutsDrawer] Failed to get/create workspace discussion:', err);
        } finally {
          if (!cancelled) setLoadingWorkspaceChat(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [mode, currentWorkspaceId, currentWorkspaceTitle, initialConversationId, user?.$id]);

  const allTargets = useMemo(() => {
    const secure = secureChats.map((c: any) => ({
      id: c.$id || c.id,
      label: c.name || c.title || (c.type === 'group' ? 'Hangout' : 'Chat'),
      kind: 'secure' as const,
      type: c.type || 'direct',
      raw: c,
      isEncrypted: !!c.isEncrypted,
      participants: c.participants || [],
      lastMessageText: c.lastMessageText || '',
      lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt,
      isWorkspace: !!c.isWorkspace,
    }));
    const discuss = threads.map((t: any) => ({
      id: t.$id || t.id,
      label: t.title || t.name || t.lastMessageText || 'Thread',
      kind: 'thread' as const,
      type: 'thread',
      raw: t,
      isEncrypted: false,
      participants: t.participants || [],
      lastMessageText: t.lastMessageText || '',
      lastMessageAt: t.lastMessageAt || t.updatedAt || t.createdAt,
      isWorkspace: false,
    }));
    return [...secure, ...discuss];
  }, [secureChats, threads]);

  const filteredTargets = useMemo(() => {
    return allTargets.filter((t) => {
      if (filterTab === 'direct' && (t.kind !== 'secure' || t.type !== 'direct')) return false;
      if (filterTab === 'group' && (t.kind !== 'secure' || t.type !== 'group')) return false;
      if (filterTab === 'thread' && t.kind !== 'thread') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.label.toLowerCase().includes(q) ||
        (t.lastMessageText && t.lastMessageText.toLowerCase().includes(q))
      );
    });
  }, [allTargets, filterTab, searchQuery]);

  const toggleShareSelect = (id: string, disabled?: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShareSend = async () => {
    if (!user?.$id || !object || selected.size === 0) return;
    setSending(true);
    try {
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
      let shareUrl = '';
      try {
        shareUrl = buildPublicResourceUrl(object.resourceType, object.id, {});
      } catch {
        shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${object.resourceType}/${object.id}` : '';
      }
      const messageText = `${object.title ? `${object.title}\n` : ''}${shareUrl}`.trim() + `\n\nShared ${object.kind}`;

      const targets = allTargets.filter((t) => selected.has(t.id));
      for (const target of targets) {
        if (target.kind === 'secure') {
          await ChatService.sendMessage(target.id, user.$id, messageText, 'text' as any, [], undefined, {
            type: 'objectShare',
            objectKind: object.kind,
            objectId: object.id,
            title: object.title,
            url: shareUrl,
          } as any);
        } else {
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

  // If actively viewing a conversation window
  if (activeConvId) {
    return (
      <div className="flex h-full min-h-[500px] flex-col bg-[#0A0908] text-white select-none">
        <ChatWindow
          conversationId={activeConvId}
          layout="fill"
          onBack={() => {
            // When navigating back from chat window:
            // return to the hangouts drawer list so they can explore other chats!
            setActiveConvId(null);
            setWasDirectWorkspaceOpen(false);
          }}
        />
      </div>
    );
  }

  if (loadingWorkspaceChat) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center gap-3 bg-[#0A0908] text-white">
        <Loader2 size={24} className="animate-spin text-[#A855F7]" />
        <p className="text-xs font-bold font-satoshi text-white/50">
          Opening {currentWorkspaceTitle || 'Workspace'} Discussion...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[460px] max-h-[85vh] md:max-h-none flex-col bg-[#0A0908] text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A0908] px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.08] text-[#A855F7] shrink-0">
            <MessageCircleMore size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black font-clash text-white truncate m-0">
              {mode === 'share' && object ? `Share "${object.title || 'Item'}"` : 'Hangouts & Chats'}
            </h2>
            <p className="text-[11px] font-bold text-white/40 font-satoshi truncate m-0">
              {mode === 'share'
                ? 'Select hangouts to share with'
                : currentWorkspaceTitle
                ? `${currentWorkspaceTitle} • Connect`
                : 'Instant discussions and encrypted chats'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {mode === 'browse' && (
            <button
              type="button"
              onClick={() => setShowCreateChat(true)}
              className="p-2 rounded-xl bg-[#161412] border border-white/[0.08] text-white/70 hover:text-white hover:bg-[#1C1A18] transition-colors"
              title="New Hangout"
            >
              <Plus size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-[#161412] transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search & Tabs for Browse Mode */}
      {mode === 'browse' && (
        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-[#161412]/50 space-y-2 shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-white/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hangouts..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#0A0908] border border-white/[0.06] text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#A855F7]/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'direct', label: 'Direct' },
                { id: 'group', label: 'Groups' },
                { id: 'thread', label: 'Threads' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-[#A855F7] text-white shadow-[0_2px_8px_rgba(168,85,247,0.25)]'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0 scrollbar-thin">
        {initialLoading && filteredTargets.length === 0 ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-[#161412]/50 p-2.5 animate-pulse"
              >
                <div className="h-10 w-10 shrink-0 rounded-2xl bg-white/[0.05]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-white/[0.08]" />
                  <div className="h-2.5 w-2/3 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#161412] border border-white/[0.06] mx-auto grid place-items-center text-white/30">
              <MessageCircleMore size={20} />
            </div>
            <p className="text-xs font-bold text-white/40 font-satoshi">
              {searchQuery ? 'No matching hangouts found' : 'No hangouts found'}
            </p>
            {mode === 'browse' && (
              <button
                type="button"
                onClick={() => setShowCreateChat(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#A855F7] text-white hover:bg-[#9333ea] transition-all"
              >
                <Plus size={14} />
                <span>Start a Hangout</span>
              </button>
            )}
          </div>
        ) : (
          filteredTargets.map((target) => {
            const isSelected = selected.has(target.id);
            const isSecureLocked = target.kind === 'secure' && target.isEncrypted && !isUnlocked;

            return (
              <button
                key={target.id}
                type="button"
                onClick={() => {
                  if (mode === 'share') {
                    toggleShareSelect(target.id, isSecureLocked);
                  } else {
                    if (!isSecureLocked) {
                      setActiveConvId(target.id);
                    }
                  }
                }}
                disabled={mode === 'share' && isSecureLocked}
                className={`w-full flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all cursor-pointer ${
                  isSecureLocked
                    ? 'bg-[#161412]/60 border-white/[0.03] opacity-50 blur-[0.4px] cursor-not-allowed'
                    : mode === 'share' && isSelected
                    ? 'bg-[#1C1A18] border-[#A855F7]/50 shadow-[0_2px_10px_rgba(168,85,247,0.15)]'
                    : 'bg-[#161412] border-white/[0.05] hover:border-white/15 hover:bg-[#1A1816]'
                }`}
              >
                {/* Avatar */}
                <div className="h-10 w-10 shrink-0 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0A0908] flex items-center justify-center relative">
                  {target.kind === 'secure' ? (
                    <IdentityAvatar
                      userId={target.participants?.find((p: string) => p !== user?.$id) || undefined}
                      size={40}
                      fallback={(target.label || '?').charAt(0).toUpperCase()}
                    />
                  ) : (
                    <div className="h-10 w-10 grid place-items-center text-[#A855F7]">
                      <MessageCircleMore size={16} />
                    </div>
                  )}
                  {target.isWorkspace && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#A855F7] border border-[#0A0908] grid place-items-center">
                      <Sparkles size={8} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold font-satoshi text-white truncate m-0">
                      {target.label}
                    </p>
                    {target.isEncrypted && <Lock size={11} className="text-[#F59E0B] shrink-0" />}
                    {target.isWorkspace && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-[#A855F7]/15 text-[#c084fc] border border-[#A855F7]/25 shrink-0">
                        Workspace
                      </span>
                    )}
                    {target.kind === 'thread' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-white/10 text-white/50 shrink-0">
                        Thread
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40 font-satoshi truncate m-0 mt-0.5">
                    {target.lastMessageText ||
                      (target.kind === 'secure'
                        ? `${target.participants?.length || 2} members`
                        : 'Resource discussion')}
                    {isSecureLocked ? ' • vault locked' : ''}
                  </p>
                </div>

                {/* Action Indicator */}
                {mode === 'share' ? (
                  <div
                    className={`h-5 w-5 rounded-lg border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#A855F7] border-[#A855F7] text-white'
                        : 'border-white/20 text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                ) : (
                  <div className="text-white/30 shrink-0">
                    <ChevronLeft size={14} className="rotate-180" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Share Send Footer */}
      {mode === 'share' && (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0A0908] p-4">
          <button
            type="button"
            onClick={handleShareSend}
            disabled={sending || selected.size === 0}
            className="w-full h-11 rounded-xl bg-[#A855F7] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(168,85,247,0.3)] transition-all"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2.5} />}
            {sending
              ? 'Sending...'
              : `Send to ${selected.size || ''} ${
                  selected.size === 1 ? 'hangout' : selected.size ? 'hangouts' : 'hangout'
                }`.trim()}
          </button>
        </div>
      )}

      {/* Create Chat Modal */}
      {showCreateChat && (
        <ChatCreateDrawer
          open={showCreateChat}
          onClose={() => {
            setShowCreateChat(false);
            void refreshChats();
          }}
        />
      )}
    </div>
  );
}
