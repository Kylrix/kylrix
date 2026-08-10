'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldCheck, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { ChatService } from '@/lib/services/chat';
import { listGhostNoteChats } from '@/lib/actions/client-ops';
import {
  peekChatsListMemory,
  peekThreadsListMemory,
  readChatsListLocal,
  readThreadsListLocal,
  writeChatsListLocal,
  writeThreadsListLocal,
} from '@/lib/chat/local-chat-cache';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { getCachedIdentityById } from '@/lib/identity-cache';

type RailMode = 'compact' | 'full';
type RailTab = 'secure' | 'public';

type Props = {
  mode?: RailMode;
  activeId?: string | null;
  /** When set, clicking a row calls this instead of navigating (optional). */
  onSelect?: (id: string) => void;
};

type RailItem = {
  id: string;
  name: string;
  avatar?: string | null;
  kind: 'secure' | 'thread';
  subtitle?: string;
};

function mapSecure(rows: any[]): RailItem[] {
  return (rows || []).map((c) => {
    const otherId =
      c.otherUserId ||
      (Array.isArray(c.participants)
        ? c.participants.find((p: string) => p && p !== c._viewerId)
        : null);
    const cached = otherId ? getCachedIdentityById(otherId) : null;
    return {
      id: c.$id || c.id,
      name:
        c.name ||
        cached?.displayName ||
        cached?.username ||
        c.title ||
        'Chat',
      avatar: c.avatarUrl || c.avatar || cached?.avatar || null,
      kind: 'secure' as const,
      subtitle: c.lastMessageText || c.lastMessage || '',
    };
  });
}

function mapThreads(rows: any[]): RailItem[] {
  return (rows || []).map((c) => ({
    id: c.$id || c.id,
    name: c.title || c.name || 'Thread',
    avatar: c.avatarUrl || c.avatar || null,
    kind: 'thread' as const,
    subtitle: c.lastMessageText || '',
  }));
}

/**
 * Communicative secondary rail — WhatsApp-style chat switcher.
 * full: icons + names (list home). compact: avatar strip (detail).
 */
export function ConnectCommRail({ mode = 'full', activeId = null, onSelect }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { open: openUnified } = useUnifiedDrawer();
  const { requestSudo } = useSudo();
  const { openAgenticDrawer } = useAgenticDrawer();
  const [_tab, _setTab] = useState<RailTab>(
    ecosystemSecurity.status.isUnlocked ? 'secure' : 'public',
  );
  const [secure, setSecure] = useState<RailItem[]>(() => mapSecure(peekChatsListMemory()));
  const [threads, setThreads] = useState<RailItem[]>(() => mapThreads(peekThreadsListMemory()));
  const [loading, setLoading] = useState(
    () => peekChatsListMemory().length === 0 && peekThreadsListMemory().length === 0,
  );
  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [needsMasterPass, setNeedsMasterPass] = useState(false);

  const openItem = useCallback(
    (id: string) => {
      if (id === 'kylie_assistant_chat') {
        openAgenticDrawer();
        return;
      }
      if (onSelect) {
        onSelect(id);
        return;
      }
      router.replace(`/connect/chats?c=${encodeURIComponent(id)}`, { scroll: false });
    },
    [onSelect, router, openAgenticDrawer],
  );

  useEffect(() => {
    const unsub = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
      if (status.isUnlocked) setNeedsMasterPass(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.$id || isUnlocked) {
      setNeedsMasterPass(false);
      return;
    }
    let cancelled = false;
    import('@/lib/appwrite/keychain')
      .then(({ KeychainService }) => KeychainService.hasMasterpass(user.$id))
      .then((has) => {
        if (!cancelled) setNeedsMasterPass(!has);
      })
      .catch(() => {
        if (!cancelled) setNeedsMasterPass(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.$id, isUnlocked]);

  useEffect(() => {
    let cancelled = false;
    // Instant paint: peek memory before async disk (0ms) per architecture.local-first
    const memSecure = peekChatsListMemory();
    const memThreads = peekThreadsListMemory();
    if (memSecure.length) {
      setSecure(mapSecure(memSecure));
      setLoading(false);
    }
    if (memThreads.length) {
      setThreads(mapThreads(memThreads));
      setLoading(false);
    }
    (async () => {
      // Always hydrate from disk even if user not yet resolved (guest local copy)
      const [cachedSecure, cachedThreads] = await Promise.all([
        readChatsListLocal(),
        readThreadsListLocal(),
      ]);
      if (!cancelled) {
        if (cachedSecure.length) {
          setSecure(mapSecure(cachedSecure));
          setLoading(false);
        }
        if (cachedThreads.length) {
          setThreads(mapThreads(cachedThreads));
          setLoading(false);
        }
        // If we have anything local, hide skeleton immediately — don't wait for network
        if (cachedSecure.length || cachedThreads.length || memSecure.length || memThreads.length) {
          setLoading(false);
        }
      }
      if (!user?.$id) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
        const raced = await (Promise.race([
          Promise.all([
            ChatService.getConversations(user.$id).catch(() => ({ rows: [] as any[] })),
            listGhostNoteChats().catch(() => [] as any[]),
          ]),
          timeout(4000),
        ] as any).catch((e) => {
          console.warn('[ConnectCommRail] fetch timed out:', (e as any)?.message);
          return null;
        }) as any);
        if (!raced) {
          if (!cancelled) setLoading(false);
          return;
        }
        const [secureRes, ghostRows] = raced as any;
        const secureRows = ((secureRes as any)?.rows || []).map((c: any) => ({
          ...c,
          _viewerId: user.$id,
        }));
        const threadRows = Array.isArray(ghostRows) ? ghostRows : [];

        // Merge prior local names/avatars so raw server rows don't blank the rail
        const prevSecure = cachedSecure.length ? cachedSecure : peekChatsListMemory();
        const prevById = new Map(prevSecure.map((c: any) => [c.$id || c.id, c]));
        const mergedSecure = secureRows.map((row: any) => {
          const prev = prevById.get(row.$id);
          if (!prev) return row;
          return {
            ...row,
            name: row.name && !String(row.name).startsWith('@') ? row.name : prev.name || row.name,
            avatarUrl: row.avatarUrl || prev.avatarUrl || prev.avatar || null,
            isSelf: row.isSelf || prev.isSelf,
            otherUserId: row.otherUserId || prev.otherUserId,
            lastMessageText: row.lastMessageText || prev.lastMessageText,
          };
        });

        if (!cancelled) {
          setSecure(mapSecure(mergedSecure));
          setThreads(mapThreads(threadRows));
          setLoading(false);
        }
        writeChatsListLocal(mergedSecure);
        if (threadRows.length) writeThreadsListLocal(threadRows);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.$id]);

  const items = (() => {
    const kylieRailItem: RailItem = {
      id: 'kylie_assistant_chat',
      name: 'Kylie Assist',
      avatar: null,
      kind: 'thread',
      subtitle: 'Ask Kylie for help...',
      isKylie: true,
    } as any;
    const combined = [...secure, ...threads];
    return [kylieRailItem, ...combined];
  })();

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#000000]">
      <div
        className={`shrink-0 border-b border-white/8 ${
          mode === 'compact' ? 'p-2' : 'px-3 py-3'
        }`}
      >
        {mode === 'full' ? (
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-white font-black text-sm font-clash tracking-tight">Chats</h2>
            <button
              type="button"
              onClick={() =>
                openUnified('new-chat', {
                  mode: 'secure',
                })
              }
              className="w-8 h-8 rounded-lg bg-[#F59E0B] text-black flex items-center justify-center"
              aria-label="New chat"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              openUnified('new-chat', {
                mode: 'secure',
              })
            }
            className="w-full aspect-square rounded-xl bg-[#161412] border border-[#34322F] flex items-center justify-center text-[#F59E0B] mb-2"
            aria-label="New chat"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        )}

        {/* Unified: no separate tabs — secret chats show lock on avatar */}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {mode === 'full' && (needsMasterPass || !isUnlocked) ? (
          <div className="m-2 rounded-2xl border border-[#F59E0B]/25 bg-[#161412] p-4 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F59E0B]/10 text-[#F59E0B]">
              <ShieldCheck size={20} />
            </div>
            <p className="text-white text-xs font-black font-clash m-0 mb-1">
              {needsMasterPass ? 'Set up Master Pass' : 'Unlock secure chats'}
            </p>
            <p className="text-white/45 text-[10px] leading-relaxed m-0 mb-3">
              {needsMasterPass
                ? 'Create a Master Pass to use private chats on this device.'
                : 'Unlock to load your private conversations. Chats list is shown from local copy.'}
            </p>
            <button
              type="button"
              onClick={() =>
                requestSudo({
                  intent: needsMasterPass ? 'initialize' : undefined,
                  onSuccess: () => {
                    setIsUnlocked(true);
                    setNeedsMasterPass(false);
                  },
                })
              }
              className="w-full h-9 rounded-xl bg-[#F59E0B] text-black text-[11px] font-extrabold"
            >
              {needsMasterPass ? 'Set up Master Pass' : 'Unlock'}
            </button>
          </div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`rounded-xl bg-[#161412] animate-pulse ${
                  mode === 'compact' ? 'aspect-square' : 'h-14'
                }`}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-white/35 text-[10px] font-bold text-center px-2 py-6">
            {mode === 'compact' ? '—' : 'No chats yet'}
          </p>
        ) : (
          <ul className={`py-1 ${mode === 'compact' ? 'px-1.5 space-y-1' : 'px-2 space-y-0.5'}`}>
            {items.map((item) => {
              const active = item.id === activeId;
              if (mode === 'compact') {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item.id)}
                      title={item.name}
                      className={`w-full aspect-square rounded-xl flex items-center justify-center border transition-colors ${
                        active
                          ? 'border-[#F59E0B] bg-[#F59E0B]/15'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className="relative inline-flex">
                        <IdentityAvatar
                          userId={item.id}
                          fileId={item.avatar}
                          alt={item.name}
                          fallback={item.name.replace(/^@/, '').charAt(0).toUpperCase() || 'C'}
                          size={36}
                        />
                        {item.kind === 'secure' && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0A0908] border border-[#34322F] flex items-center justify-center">
                            <Lock size={8} className="text-[#F59E0B]" />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item.id)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                      active
                        ? 'bg-[#F59E0B]/12 border border-[#F59E0B]/35'
                        : 'border border-transparent hover:bg-white/5'
                    }`}
                  >
                    <span className="relative inline-flex shrink-0">
                      {item.isKylie ? (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#6366F1]">
                          <Sparkles size={18} strokeWidth={2.2} />
                        </div>
                      ) : (
                        <IdentityAvatar
                          userId={item.id}
                          fileId={item.avatar}
                          alt={item.name}
                          fallback={item.name.replace(/^@/, '').charAt(0).toUpperCase() || 'C'}
                          size={40}
                        />
                      )}
                      {item.kind === 'secure' && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0A0908] border border-[#34322F] flex items-center justify-center">
                          <Lock size={10} className="text-[#F59E0B]" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-bold truncate font-satoshi m-0">
                        {item.name}
                      </p>
                      {item.subtitle ? (
                        <p className="text-white/40 text-[11px] truncate m-0 mt-0.5">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
