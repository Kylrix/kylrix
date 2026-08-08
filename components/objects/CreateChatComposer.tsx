'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, MessageSquare, Users, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { ChatService } from '@/lib/services/chat';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createGhostNoteChat, listGhostNoteChats } from '@/lib/actions/client-ops';
import { formatSecureChatStartError } from '@/lib/crypto/public-key';
import {
  discoverRecipientSecureReady,
  resolveChatChannelKind,
  canonicalDirectParticipants,
  directParticipantsEqual,
  extractGhostParticipantIds,
} from '@/lib/chat/recipient-secure-ready';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { openCommObjectDetail } from '@/components/objects/CommObjectDetail';

export type ChatCreateMode = 'chat' | 'hangout';

type Props = {
  onClose: () => void;
  onRegisterClose?: (close: () => void) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Seed mode — chat (1:1) default, hangout = multi-recipient group */
  initialMode?: ChatCreateMode;
  /** True only when user opened create from Threads (explicit thread intent) */
  legacyThread?: boolean;
};

const HANGOUT_MAX = 15; // + self = 16

/**
 * Create chat / hangout composer — lives inside ObjectCreateDrawer shell.
 */
export function CreateChatComposer({
  onClose,
  onRegisterClose,
  isExpanded,
  onToggleExpand,
  initialMode = 'chat',
  legacyThread = false,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { requestSudo } = useSudo();
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();

  const [mode, setMode] = useState<ChatCreateMode>(initialMode);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [hangoutName, setHangoutName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    onRegisterClose?.(() => onClose());
  }, [onClose, onRegisterClose]);

  /** Open fullscreen / sidebar chat detail — no dedicated chat page navigation. */
  const openConversation = useCallback(
    (id: string, kind: 'chat' | 'thread' = 'chat') => {
      onClose();
      const onChatsPage = Boolean(pathname?.startsWith('/connect/chats'));
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;

      // Desktop chats already has a fused right pane — hydrate via ?c=
      if (isDesktop && onChatsPage) {
        router.replace(`/connect/chats?c=${encodeURIComponent(id)}`, { scroll: false });
        return;
      }

      openCommObjectDetail({
        conversationId: id,
        kind,
        openSidebar,
        openOverlay,
        closeSidebar,
        closeOverlay,
      });
    },
    [onClose, pathname, router, openSidebar, openOverlay, closeSidebar, closeOverlay],
  );

  const startDirectChat = useCallback(
    async (targetUser: any) => {
      if (!user) return;
      const targetUserId = targetUser.id || targetUser.$id || targetUser.userId;

      toast.loading('Checking secure setup…', { id: 'chat-create' });

      const [selfDiscovery, discovery] = await Promise.all([
        discoverRecipientSecureReady(user.$id),
        discoverRecipientSecureReady(
          targetUserId,
          typeof targetUser.publicKey === 'string' ? targetUser.publicKey : null,
        ),
      ]);

      const channel = resolveChatChannelKind({
        recipientReady: discovery.ready,
        selfReady: selfDiscovery.ready,
        explicitThread: legacyThread,
      });

      // Explicit thread OR either side not secure-ready → thread (hardened)
      if (channel === 'thread') {
        try {
          if (!legacyThread && (!discovery.ready || !selfDiscovery.ready)) {
            toast(
              "This person hasn't set up secure chat yet. Starting a standard chat instead.",
              { id: 'chat-create' },
            );
          } else {
            toast.loading('Opening chat…', { id: 'chat-create' });
          }

          const existingGhosts = await listGhostNoteChats();
          const targetSet = canonicalDirectParticipants([user.$id, targetUserId]);
          const foundGhost = existingGhosts.find((c: any) => {
            const participants = extractGhostParticipantIds(c);
            return directParticipantsEqual(participants, targetSet);
          });
          if (foundGhost) {
            toast.dismiss('chat-create');
            openConversation(foundGhost.$id, 'thread');
            return;
          }
          const title =
            discovery.profile?.displayName ||
            targetUser.displayName ||
            targetUser.username ||
            targetUser.title ||
            'Chat';
          const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
          toast.success('Chat ready', { id: 'chat-create' });
          openConversation(newGhost.$id, 'thread');
        } catch (error: any) {
          toast.error(formatSecureChatStartError(error, 'thread'), { id: 'chat-create' });
        }
        return;
      }

      // Secure path — BOTH ready. Hardened presence check before creating.
      const openSecure = async () => {
        try {
          await ecosystemSecurity.ensureE2EIdentity(user.$id);
          const targetSet = canonicalDirectParticipants([user.$id, targetUserId]);
          try {
            const existing = await ChatService.getConversations(user.$id);
            const found = existing.rows.find((c: any) => {
              if (c.type !== 'direct' || !Array.isArray(c.participants)) return false;
              return directParticipantsEqual(
                canonicalDirectParticipants(c.participants),
                targetSet,
              );
            });
            if (found) {
              toast.dismiss('chat-create');
              openConversation(found.$id, 'chat');
              return;
            }
          } catch {
            /* create new */
          }

          const newConv = await ChatService.createConversation(
            [user.$id, targetUserId],
            'direct',
          );
          toast.success('Secure chat ready', { id: 'chat-create' });
          openConversation(newConv.$id, 'chat');
        } catch (error: any) {
          toast.error(formatSecureChatStartError(error, 'secure'), { id: 'chat-create' });
        }
      };

      if (!ecosystemSecurity.status.isUnlocked) {
        toast.dismiss('chat-create');
        requestSudo({
          onSuccess: () => {
            void openSecure();
          },
        });
        return;
      }

      await openSecure();
    },
    [user, legacyThread, openConversation, requestSudo],
  );

  const createHangout = useCallback(async () => {
    if (!user) return;
    if (!hangoutName.trim()) {
      toast.error('Name your hangout');
      return;
    }
    if (selectedUsers.length === 0) {
      toast.error('Add at least one person');
      return;
    }
    if (selectedUsers.length > HANGOUT_MAX) {
      toast.error(`Hangouts cap at ${HANGOUT_MAX + 1} people including you`);
      return;
    }

    setBusy(true);
    requestSudo({
      onSuccess: async () => {
        try {
          await ecosystemSecurity.ensureE2EIdentity(user.$id);
          const participantIds = [
            user.$id,
            ...selectedUsers.map((u) => u.id || u.$id),
          ];
          // Live discovery for every member — refuse hangout if anyone is not secure-ready
          const discoveries = await Promise.all(
            participantIds.map((id) => discoverRecipientSecureReady(id)),
          );
          const missing = discoveries.find((d) => d.userId !== user.$id && !d.ready);
          if (missing) {
            const label =
              missing.profile?.displayName ||
              missing.profile?.username ||
              'A member';
            throw new Error(`${label} hasn't set up secure chat yet.`);
          }
          const newConv = await ChatService.createConversation(
            participantIds,
            'group',
            hangoutName.trim(),
          );
          toast.success('Hangout ready');
          openConversation(newConv.$id, 'chat');
        } catch (error: any) {
          toast.error(error?.message || 'Failed to create hangout');
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => setBusy(false),
    });
  }, [
    user,
    hangoutName,
    selectedUsers,
    requestSudo,
    openConversation,
  ]);

  // 1:1 chat — pick one person starts immediately
  useEffect(() => {
    if (mode !== 'chat') return;
    if (selectedUsers.length !== 1) return;
    const target = selectedUsers[0];
    setSelectedUsers([]);
    void startDirectChat(target);
  }, [mode, selectedUsers, startDirectChat]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161412] text-white font-satoshi">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#34322F] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-[#0A0908] border border-[#34322F] text-[#F59E0B] shrink-0">
            {mode === 'hangout' ? <Users className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black font-clash text-white tracking-tight truncate m-0">
              {mode === 'hangout' ? 'New hangout' : legacyThread ? 'New thread' : 'New chat'}
            </h3>
            {mode === 'chat' && !legacyThread ? (
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0 mt-0.5 flex items-center gap-1">
                <Lock size={10} className="text-[#F59E0B]" />
                Secure when available
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#0A0908] transition-colors md:hidden"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#0A0908] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 shrink-0">
        <div className="flex p-1 rounded-xl bg-[#0A0908] border border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              setMode('chat');
              setSelectedUsers([]);
            }}
            className={`flex-1 h-9 rounded-lg text-xs font-extrabold transition-colors ${
              mode === 'chat'
                ? 'bg-[#161412] text-[#F59E0B] border border-[#34322F]'
                : 'text-white/45 hover:text-white'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('hangout');
              setSelectedUsers([]);
            }}
            className={`flex-1 h-9 rounded-lg text-xs font-extrabold transition-colors ${
              mode === 'hangout'
                ? 'bg-[#161412] text-[#F59E0B] border border-[#34322F]'
                : 'text-white/45 hover:text-white'
            }`}
          >
            Hangout
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {mode === 'hangout' ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45 font-mono block">
              Hangout name
            </label>
            <input
              value={hangoutName}
              onChange={(e) => setHangoutName(e.target.value)}
              placeholder="e.g. Weekend crew"
              className="w-full rounded-xl bg-[#0A0908] border border-[#34322F] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-[#F59E0B]/50"
            />
          </div>
        ) : null}

        <UserSearch
          label={mode === 'hangout' ? 'ADD PEOPLE' : 'FIND SOMEONE'}
          placeholder="Search by name or @username"
          selectedUsers={selectedUsers}
          onSelect={(u) => {
            if (mode === 'hangout') {
              void (async () => {
                const id = u.id || (u as any).$id;
                const d = await discoverRecipientSecureReady(
                  id,
                  typeof u.publicKey === 'string' ? u.publicKey : null,
                );
                if (!d.ready) {
                  toast.error(
                    `${u.displayName || u.username} hasn't set up secure chat yet.`,
                  );
                  return;
                }
                if (selectedUsers.length >= HANGOUT_MAX) {
                  toast.error(`Up to ${HANGOUT_MAX} people besides you`);
                  return;
                }
                setSelectedUsers((prev) =>
                  prev.some((x) => (x.id || (x as any).$id) === id)
                    ? prev
                    : [...prev, { ...u, publicKey: d.publicKey }],
                );
              })();
              return;
            }
            setSelectedUsers([u]);
          }}
          onRemove={(id) =>
            setSelectedUsers((prev) => prev.filter((u) => (u.id || (u as any).$id) !== id))
          }
          multiple={mode === 'hangout'}
          excludeIds={user?.$id ? [user.$id] : []}
          inlineResults={mode === 'chat'}
        />

        {mode === 'chat' && !selectedUsers.length ? (
          <p className="text-center text-xs text-white/35 py-8 font-semibold">
            Pick someone to start a chat
          </p>
        ) : null}
      </div>

      {mode === 'hangout' ? (
        <div className="px-5 py-4 border-t border-[#34322F] shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-12 rounded-xl border border-white/10 bg-white/[0.02] text-white font-bold text-sm hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !hangoutName.trim() || selectedUsers.length === 0}
            onClick={() => void createHangout()}
            className="flex-1 h-12 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm disabled:opacity-40 hover:bg-amber-500 transition-colors"
          >
            {busy ? 'Creating…' : 'Create hangout'}
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 border-t border-[#34322F]/0 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.02] text-white font-bold text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
