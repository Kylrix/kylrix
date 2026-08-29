'use client';

import React, { useEffect, useState, useTransition, useMemo, useCallback, useRef } from 'react';
import {
  Send,
  Lock,
  MessageCircleMore,
  Check,
  Loader2,
  Plus,
  Search,
  X,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { ChatService } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
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
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { openCommObjectDetail } from '@/components/objects/CommObjectDetail';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ChatCreateDrawer } from '@/components/objects/ChatCreateDrawer';
import {
  shouldRunEmptyEscapeHatch,
  markEmptyEscapeHatchRan,
} from '@/lib/sync/local-copy-sync';
import {
  formatConversationListTime,
  resolveConversationListLabel,
  resolveDirectChatPeerId,
} from '@/lib/chat/conversation-list-label';
import {
  ENCRYPTED_LIST_PREVIEW_LABEL,
  resolveConversationPreviewText,
} from '@/lib/chat/conversation-preview-label';
import { isLikelyChatCiphertext } from '@/lib/chat/local-chat-cache';
import { getCachedIdentityById, resolveIdentityById, seedIdentityCache } from '@/lib/identity-cache';

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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function HangoutsDrawer({
  mode = 'browse',
  workspaceId: propWorkspaceId,
  workspaceTitle: propWorkspaceTitle,
  initialConversationId,
  object,
  onClose,
  isExpanded,
  onToggleExpand,
}: HangoutsDrawerProps) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const [, startTransition] = useTransition();
  const openedInitialRef = useRef(false);

  const [secureChats, setSecureChats] = useState<any[]>(() => peekChatsListMemory());
  const [threads, setThreads] = useState<any[]>(() => peekThreadsListMemory());
  const [initialLoading, setInitialLoading] = useState<boolean>(() => !peekChatsListMemory().length && !peekThreadsListMemory().length);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'group' | 'thread'>('all');
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [identityHydrationTick, setIdentityHydrationTick] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(() => ecosystemSecurity.status.isUnlocked);

  useEffect(() => {
    return ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
    });
  }, []);

  const isVaultUnlocked = isUnlocked;

  const hydrateDecryptedSecureChats = useCallback(
    async (rows: any[]) => {
      if (!user?.$id || !ecosystemSecurity.status.isUnlocked || !rows.length) return rows;
      const patches = new Map<string, { name?: string; lastMessageText?: string }>();
      await Promise.allSettled(
        rows
          .filter((conv) => conv?.isEncrypted)
          .map(async (conv) => {
            const id = conv.$id || conv.id;
            if (!id) return;
            try {
              const decrypted = await (ChatService as any)._decryptConversation({ ...conv }, user.$id);
              if (!decrypted) return;
              const patch: { name?: string; lastMessageText?: string } = {};
              if (
                decrypted.name &&
                decrypted.name !== conv.name &&
                !isLikelyChatCiphertext(decrypted.name)
              ) {
                patch.name = decrypted.name;
              }
              if (
                decrypted.lastMessageText &&
                decrypted.lastMessageText !== conv.lastMessageText &&
                !isLikelyChatCiphertext(decrypted.lastMessageText)
              ) {
                patch.lastMessageText = decrypted.lastMessageText;
              }
              if (Object.keys(patch).length) patches.set(id, patch);
            } catch {
              /* keep masked preview */
            }
          }),
      );
      if (!patches.size) return rows;
      return rows.map((conv) => {
        const id = conv.$id || conv.id;
        const patch = id ? patches.get(id) : undefined;
        return patch ? { ...conv, ...patch } : conv;
      });
    },
    [user?.$id],
  );

  const openConversation = useCallback(
    (conversationId: string, kind: 'chat' | 'thread' = 'chat', title?: string) => {
      onClose?.();
      openCommObjectDetail({
        conversationId,
        kind,
        title,
        fullscreen: true,
        openSidebar,
        openOverlay,
        closeSidebar,
        closeOverlay,
      });
    },
    [onClose, openSidebar, openOverlay, closeSidebar, closeOverlay],
  );

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
        const decryptedCached = await hydrateDecryptedSecureChats(cachedChats);
        startTransition(() => setSecureChats(decryptedCached));
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
            const decryptedRows = await hydrateDecryptedSecureChats(rows);
            startTransition(() => setSecureChats(decryptedRows));
            void writeChatsListLocal(decryptedRows);
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
  }, [user?.$id, hydrateDecryptedSecureChats]);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    if (!isVaultUnlocked) return;
    let cancelled = false;
    void (async () => {
      const current = peekChatsListMemory();
      if (!current.length) return;
      const decryptedRows = await hydrateDecryptedSecureChats(current);
      if (cancelled) return;
      startTransition(() => setSecureChats(decryptedRows));
      void writeChatsListLocal(decryptedRows);
    })();
    return () => {
      cancelled = true;
    };
  }, [isVaultUnlocked, hydrateDecryptedSecureChats]);

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!user?.$id) return;
    const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
    const convsTable = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
    const msgsTable = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
    const threadsTable = APPWRITE_CONFIG.TABLES.NOTE.THREADS;

    const channel1 = `databases.${dbId}.collections.${convsTable}.documents`;
    const channel2 = `databases.${dbId}.collections.${msgsTable}.documents`;
    const channel3 = `databases.${APPWRITE_CONFIG.DATABASES.MAIN}.collections.${threadsTable}.documents`;

    const unsub = realtime.subscribe([channel1, channel2, channel3], (event: any) => {
      const payload = event.payload;
      if (!payload) return;

      // Check if event is a conversation update/create/delete
      if (event.events?.some((e: string) => e.includes(`collections.${convsTable}.documents`))) {
        if (event.events.some((e: string) => e.endsWith('.delete'))) {
          const deletedId = payload.$id || payload.id;
          startTransition(() => {
            setSecureChats((prev) => {
              const next = prev.filter((c: any) => (c.$id || c.id) !== deletedId);
              void writeChatsListLocal(next);
              return next;
            });
          });
        } else {
          startTransition(() => {
            setSecureChats((prev) => {
              const id = payload.$id || payload.id;
              const idx = prev.findIndex((c: any) => (c.$id || c.id) === id);
              let next: any[];
              if (idx >= 0) {
                next = [...prev];
                next[idx] = { ...next[idx], ...payload };
              } else {
                next = [payload, ...prev];
              }
              next.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime());
              void writeChatsListLocal(next);
              return next;
            });
          });
        }
      }

      // Check if event is a new message (update lastMessage preview)
      if (event.events?.some((e: string) => e.includes(`collections.${msgsTable}.documents`))) {
        const convId = payload.conversationId;
        if (convId) {
          startTransition(() => {
            setSecureChats((prev) => {
              const idx = prev.findIndex((c: any) => (c.$id || c.id) === convId);
              if (idx >= 0) {
                const updated = {
                  ...prev[idx],
                  lastMessageText: payload.content || prev[idx].lastMessageText,
                  lastMessageAt: payload.$createdAt || payload.createdAt || new Date().toISOString(),
                };
                const next = [...prev];
                next[idx] = updated;
                next.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime());
                void writeChatsListLocal(next);
                return next;
              }
              return prev;
            });
          });
        }
      }
    });

    return () => {
      try {
        unsub();
      } catch (e) {
        console.warn('[HangoutsDrawer] Realtime unsubscribe error:', e);
      }
    };
  }, [user?.$id]);

  // Deep-link: open fullscreen chat and close the hangouts list drawer
  useEffect(() => {
    if (openedInitialRef.current || mode !== 'browse' || !initialConversationId) return;
    openedInitialRef.current = true;
    openConversation(initialConversationId, 'chat');
  }, [mode, initialConversationId, openConversation]);

  // Ensure workspace discussion exists in the list without auto-opening it
  useEffect(() => {
    if (mode !== 'browse' || !currentWorkspaceId || initialConversationId || !user?.$id) return;
    let cancelled = false;
    void (async () => {
      try {
        const conv = await ChatService.getOrCreateWorkspaceConversation(
          currentWorkspaceId,
          currentWorkspaceTitle,
          user.$id,
        );
        if (!cancelled && conv?.$id) {
          void refreshChats();
        }
      } catch (err: any) {
        console.warn('[HangoutsDrawer] Failed to get/create workspace discussion:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, currentWorkspaceId, currentWorkspaceTitle, initialConversationId, user?.$id, refreshChats]);

  // Resolve peer display names when stored title is the generic "Direct Chat" placeholder
  useEffect(() => {
    if (!user?.$id || !secureChats.length) return;
    const peerIds = new Set<string>();
    for (const c of secureChats) {
      if (c.type === 'group' || c.type === 'channel') continue;
      const peerId = resolveDirectChatPeerId(c.participants, user.$id);
      if (peerId && !getCachedIdentityById(peerId)) peerIds.add(peerId);
    }
    if (!peerIds.size) return;
    let cancelled = false;
    void (async () => {
      await Promise.all(
        [...peerIds].slice(0, 24).map(async (peerId) => {
          const identity = await resolveIdentityById(peerId, () => UsersService.getProfileById(peerId));
          if (identity) seedIdentityCache(identity);
        }),
      );
      if (!cancelled) setIdentityHydrationTick((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [secureChats, user?.$id]);

  const allTargets = useMemo(() => {
    void identityHydrationTick;
    const secure = secureChats.map((c: any) => {
      const resolved = resolveConversationListLabel({
        conversation: c,
        currentUserId: user?.$id,
        workspaceTitle: currentWorkspaceTitle,
      });
      return {
        id: c.$id || c.id,
        label: resolved.label,
        otherUserId: resolved.otherUserId,
        isSelf: resolved.isSelf,
        kind: 'secure' as const,
        type: c.type || 'direct',
        raw: c,
        isEncrypted: !!c.isEncrypted,
        participants: c.participants || [],
        lastMessageText: c.lastMessageText || '',
        lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt,
        isWorkspace: !!c.isWorkspace,
      };
    });
    const discuss = threads.map((t: any) => ({
      id: t.$id || t.id,
      label:
        t.title ||
        t.name ||
        (t.lastMessageText && String(t.lastMessageText).slice(0, 48)) ||
        'Thread',
      otherUserId: undefined as string | undefined,
      isSelf: false,
      kind: 'thread' as const,
      type: 'thread',
      raw: t,
      isEncrypted: false,
      participants: t.participants || [],
      lastMessageText: t.lastMessageText || '',
      lastMessageAt: t.lastMessageAt || t.updatedAt || t.createdAt,
      isWorkspace: false,
    }));
    return [...secure, ...discuss].sort(
      (a, b) =>
        new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
    );
  }, [secureChats, threads, user?.$id, currentWorkspaceTitle, identityHydrationTick]);

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

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-[#161412] text-white select-none">
      {/* Slim top controls */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="truncate text-[10px] font-mono font-bold uppercase tracking-wider text-[#A855F7]/80">
          {mode === 'share' ? 'Share' : 'Hangouts'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {mode === 'browse' && (
            <button
              type="button"
              onClick={() => setShowCreateChat(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              title="New hangout"
            >
              <Plus size={15} />
            </button>
          )}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              title={isExpanded ? 'Dock drawer' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="shrink-0 px-5 pt-3.5 pb-1">
        <h2 className="m-0 truncate font-clash text-base font-black text-white">
          {mode === 'share' && object ? `Share "${object.title || 'Item'}"` : 'Hangouts & Chats'}
        </h2>
        <p className="m-0 mt-1 truncate font-satoshi text-[11px] font-bold text-white/45">
          {mode === 'share'
            ? 'Pick hangouts to send this to'
            : currentWorkspaceTitle
              ? `${currentWorkspaceTitle} · Connect`
              : 'Discussions and private chats'}
        </p>
      </div>

      {/* Search & filter pills */}
      {mode === 'browse' && (
        <div className="shrink-0 space-y-2.5 px-4 pb-3 pt-2">
          <div className="relative flex items-center">
            <Search size={14} className="pointer-events-none absolute left-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hangouts..."
              className="h-10 w-full rounded-2xl border border-white/[0.08] bg-[#0A0908] pl-9 pr-3 text-xs text-white placeholder:text-white/25 focus:border-[#A855F7]/50 focus:outline-none"
            />
          </div>

          <div className="flex gap-0.5 rounded-2xl border border-white/[0.08] bg-[#0A0908] p-1">
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
                className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-all ${
                  filterTab === tab.id
                    ? 'bg-[#161412] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation list — messenger rows (not catalog action tiles) */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {initialLoading && filteredTargets.length === 0 ? (
          <div className="space-y-0 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06]" />
                <div className="min-w-0 flex-1 space-y-2 border-b border-white/[0.06] pb-3">
                  <div className="h-3.5 w-2/5 rounded bg-white/[0.08]" />
                  <div className="h-2.5 w-3/5 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-3 px-4 py-16 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-[#0A0908] text-white/30">
              <MessageCircleMore size={20} />
            </div>
            <p className="m-0 font-satoshi text-xs font-bold text-white/40">
              {searchQuery ? 'No matching hangouts' : 'No hangouts yet'}
            </p>
            {mode === 'browse' && (
              <button
                type="button"
                onClick={() => setShowCreateChat(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#A855F7] px-4 py-2.5 text-xs font-extrabold text-white transition-all hover:bg-[#9333ea]"
              >
                <Plus size={14} />
                <span>Start a hangout</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {filteredTargets.map((target) => {
              const isSelected = selected.has(target.id);
              const isSecureLocked = target.kind === 'secure' && target.isEncrypted && !isVaultUnlocked;
              const previewFallback =
                target.kind === 'secure'
                  ? target.type === 'group'
                    ? `${target.participants?.length || 2} members`
                    : 'No messages yet'
                  : 'Resource discussion';
              const displayPreview = resolveConversationPreviewText(target.lastMessageText, {
                isEncrypted: target.isEncrypted,
                isVaultUnlocked,
                fallback: previewFallback,
              });
              const previewIsEncrypted = displayPreview === ENCRYPTED_LIST_PREVIEW_LABEL;
              const avatarUserId =
                target.otherUserId ||
                (target.kind === 'secure'
                  ? target.participants?.find((p: string) => p !== user?.$id)
                  : undefined);
              const timeLabel = formatConversationListTime(target.lastMessageAt);

              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => {
                    if (mode === 'share') {
                      toggleShareSelect(target.id, isSecureLocked);
                    } else if (!isSecureLocked) {
                      openConversation(
                        target.id,
                        target.kind === 'thread' ? 'thread' : 'chat',
                        target.label,
                      );
                    }
                  }}
                  disabled={mode === 'share' && isSecureLocked}
                  className={`flex w-full max-w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSecureLocked
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
                  } ${mode === 'share' && isSelected ? 'bg-[#A855F7]/10' : ''}`}
                >
                  <div className="relative shrink-0">
                    {target.kind === 'secure' ? (
                      <IdentityAvatar
                        userId={avatarUserId}
                        size={48}
                        fallback={(target.label || '?').charAt(0).toUpperCase()}
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0A0908] border border-white/[0.08] text-[#A855F7]">
                        <MessageCircleMore size={20} />
                      </div>
                    )}
                    {target.isWorkspace && (
                      <div className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-[#161412] bg-[#A855F7]">
                        <Sparkles size={8} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold leading-tight text-white">
                          {target.label}
                        </span>
                        {target.isEncrypted && (
                          <Lock size={12} className="shrink-0 text-[#F59E0B]" aria-hidden />
                        )}
                      </div>
                      {timeLabel ? (
                        <span className="shrink-0 text-[11px] text-white/35">{timeLabel}</span>
                      ) : null}
                    </div>
                    <p className="m-0 mt-0.5 truncate text-[13px] leading-snug text-white/45">
                      {previewIsEncrypted ? (
                        <span className="inline-flex items-center gap-1">
                          <Lock size={12} className="text-white/35" />
                          <span>{displayPreview}</span>
                        </span>
                      ) : (
                        displayPreview
                      )}
                      {isSecureLocked ? ' · vault locked' : ''}
                    </p>
                  </div>

                  {mode === 'share' && (
                    <div
                      className={`mb-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-[#A855F7] bg-[#A855F7] text-white'
                          : 'border-white/25 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Share footer */}
      {mode === 'share' && (
        <div className="shrink-0 border-t border-white/5 bg-[#161412] px-5 py-3 md:py-3.5">
          <button
            type="button"
            onClick={handleShareSend}
            disabled={sending || selected.size === 0}
            className="inline-flex h-11 min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#A855F7] text-xs font-extrabold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
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

HangoutsDrawer.displayName = 'HangoutsDrawer';
