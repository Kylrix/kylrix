'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { ChatService } from '@/lib/services/chat';
import { UsersService } from '@/lib/services/users';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createGhostNoteChat, listGhostNoteChats } from '@/lib/actions/client-ops';
import { isValidX25519PublicKey, formatSecureChatStartError } from '@/lib/crypto/public-key';

export type ChatCreateMode = 'chat' | 'hangout';

type Props = {
  onClose: () => void;
  onRegisterClose?: (close: () => void) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /** Seed mode — chat (1:1) default, hangout = multi-recipient group */
  initialMode?: ChatCreateMode;
  /** Legacy unified-drawer thread mode maps to chat via ghost notes */
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
  const { requestSudo } = useSudo();
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isTeams =
    currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME';

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

  const openConversation = useCallback(
    (id: string) => {
      router.push(`/connect/chats?c=${id}`);
      onClose();
    },
    [router, onClose],
  );

  const startDirectChat = useCallback(
    async (targetUser: any) => {
      if (!user) return;
      const targetUserId = targetUser.id || targetUser.$id;
      let recipientPublicKey =
        typeof targetUser.publicKey === 'string' ? targetUser.publicKey : null;

      try {
        const profile = await UsersService.getProfileById(targetUserId);
        recipientPublicKey = profile?.publicKey || recipientPublicKey;
      } catch {
        /* keep */
      }

      const recipientReady = isValidX25519PublicKey(recipientPublicKey);
      const useThreadFlow =
        legacyThread || !ecosystemSecurity.status.isUnlocked || !recipientReady;

      if (useThreadFlow) {
        try {
          if (!legacyThread && ecosystemSecurity.status.isUnlocked && !recipientReady) {
            toast("This person hasn't set up secure chat yet. Starting a thread instead.");
          } else {
            toast.loading('Opening chat…', { id: 'chat-create' });
          }
          const existingGhosts = await listGhostNoteChats();
          const foundGhost = existingGhosts.find((c: any) => {
            let metadataObj: any = {};
            try {
              metadataObj =
                typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata || {};
            } catch {
              /* ignore */
            }
            const participants = c.collaborators || metadataObj.participants || [];
            return participants.includes(targetUserId);
          });
          if (foundGhost) {
            toast.dismiss('chat-create');
            openConversation(foundGhost.$id);
            return;
          }
          const title =
            targetUser.displayName || targetUser.username || targetUser.title || 'Chat';
          const newGhost = await createGhostNoteChat(title, [user.$id, targetUserId]);
          toast.success('Chat ready', { id: 'chat-create' });
          openConversation(newGhost.$id);
        } catch (error: any) {
          toast.error(formatSecureChatStartError(error, legacyThread ? 'thread' : 'secure'), {
            id: 'chat-create',
          });
        }
        return;
      }

      try {
        const existing = await ChatService.getConversations(user.$id);
        const found = existing.rows.find(
          (c: any) => c.type === 'direct' && c.participants.includes(targetUserId),
        );
        if (found) {
          openConversation(found.$id);
          return;
        }
      } catch {
        /* create new */
      }

      requestSudo({
        onSuccess: async () => {
          try {
            await ecosystemSecurity.ensureE2EIdentity(user.$id);
            const newConv = await ChatService.createConversation(
              [user.$id, targetUserId],
              'direct',
            );
            toast.success('Chat ready');
            openConversation(newConv.$id);
          } catch (error: any) {
            toast.error(formatSecureChatStartError(error, 'secure'));
          }
        },
      });
    },
    [user, legacyThread, openConversation, requestSudo],
  );

  const createHangout = useCallback(async () => {
    if (!user) return;
    if (!isTeams) {
      openProUpgrade('Hangouts');
      return;
    }
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
          const profiles = await Promise.all(
            participantIds.map((id) => UsersService.getProfileById(id)),
          );
          const missingKey = profiles.find((p) => !p?.publicKey);
          if (missingKey) {
            throw new Error(
              `${missingKey.displayName || 'A member'} is not ready for secure hangouts yet.`,
            );
          }
          const newConv = await ChatService.createConversation(
            participantIds,
            'group',
            hangoutName.trim(),
          );
          toast.success('Hangout ready');
          openConversation(newConv.$id);
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
    isTeams,
    hangoutName,
    selectedUsers,
    openProUpgrade,
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
              {mode === 'hangout' ? 'New hangout' : 'New chat'}
            </h3>
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
              if (!isValidX25519PublicKey(u.publicKey)) {
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
                prev.some((x) => (x.id || (x as any).$id) === (u.id || (u as any).$id))
                  ? prev
                  : [...prev, u],
              );
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
        <div className="px-5 py-4 border-t border-[#34322F] shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={busy || !hangoutName.trim() || selectedUsers.length === 0}
            onClick={() => void createHangout()}
            className="w-full h-12 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm disabled:opacity-40 hover:bg-amber-500 transition-colors"
          >
            {busy ? 'Creating…' : isTeams ? 'Create hangout' : 'Create hangout (Pro)'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
