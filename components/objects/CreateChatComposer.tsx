'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, MessageSquare, Shield, Users, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { ChatService } from '@/lib/services/chat';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createGhostNoteChat } from '@/lib/actions/client-ops';
import { formatSecureChatStartError } from '@/lib/crypto/public-key';
import { discoverRecipientSecureReady } from '@/lib/chat/recipient-secure-ready';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { openCommObjectDetail } from '@/components/objects/CommObjectDetail';

export type ChatCreateMode = 'chat' | 'hangout';

type Props = {
  onClose: () => void;
  onRegisterClose?: (close: () => void) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  initialMode?: ChatCreateMode;
  legacyThread?: boolean;
};

const HANGOUT_MAX = 15; // + self = 16

export function CreateChatComposer({
  onClose,
  onRegisterClose,
  isExpanded,
  onToggleExpand,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { requestSudo } = useSudo();
  const { openOverlay, closeOverlay } = useOverlay();
  const { openSidebar, closeSidebar } = useDynamicSidebar();

  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [hangoutName, setHangoutName] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(false);
  // E2E toggle — ON by default if vault unlocked, transient (not persisted)
  const [userToggledOff, setUserToggledOff] = useState(false);
  const [missingKeyIds, setMissingKeyIds] = useState<Set<string>>(new Set());

  const isUnlocked = ecosystemSecurity.status.isUnlocked;
  // Auto-off if any selected participant lacks public key, or user explicitly turned off
  const hasMissingKeys = missingKeyIds.size > 0;
  const encryptedEnabled = isUnlocked && !userToggledOff && !hasMissingKeys;

  useEffect(() => {
    onRegisterClose?.(() => onClose());
  }, [onClose, onRegisterClose]);

  // Re-evaluate readiness whenever selection changes — auto-off encryption if needed
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setMissingKeyIds(new Set());
      return;
    }
    let cancelled = false;
    setCheckingKeys(true);
    (async () => {
      const ids = selectedUsers.map((u) => u.id || (u as any).$id).filter(Boolean);
      const discoveries = await Promise.all(ids.map((id: string) => discoverRecipientSecureReady(id)));
      if (cancelled) return;
      const missing = new Set<string>();
      discoveries.forEach((d) => {
        if (!d.ready) missing.add(d.userId);
      });
      // Also check self readiness — if self has no publicKey, encryption off
      if (user?.$id) {
        const selfD = await discoverRecipientSecureReady(user.$id);
        if (!selfD.ready) missing.add(user.$id);
      }
      if (cancelled) return;
      setMissingKeyIds(missing);
      if (missing.size > 0 && isUnlocked && !userToggledOff) {
        // Auto-disable, inform once
        const names = discoveries.filter((d) => missing.has(d.userId)).map((d) => d.profile?.displayName || d.profile?.username || 'Someone').join(', ');
        if (names) toast(`Encryption off — ${names} hasn't set up secure chat`, { id: 'e2e-auto-off' });
      }
    })().finally(() => {
      if (!cancelled) setCheckingKeys(false);
    });
    return () => { cancelled = true; };
  }, [selectedUsers, user?.$id, isUnlocked, userToggledOff]);

  const openConversation = useCallback(
    (id: string, kind: 'chat' | 'thread' = 'chat') => {
      onClose();
      const onChatsPage = Boolean(pathname?.startsWith('/connect/chats'));
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
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

  const handleCreate = useCallback(async () => {
    if (!user) return;
    if (selectedUsers.length === 0) {
      toast.error('Add at least one person');
      return;
    }
    if (selectedUsers.length > HANGOUT_MAX) {
      toast.error(`Hangouts cap at ${HANGOUT_MAX + 1} people including you`);
      return;
    }
    const isGroup = selectedUsers.length > 1;
    if (isGroup && !hangoutName.trim() && encryptedEnabled) {
      toast.error('Name your hangout');
      return;
    }

    setBusy(true);

    // Discussion path — no encryption, works for any participant count
    if (!encryptedEnabled) {
      try {
        const participantIds = [user.$id, ...selectedUsers.map((u) => u.id || (u as any).$id)];
        const title = isGroup
          ? (hangoutName.trim() || `Hangout with ${selectedUsers.map((u) => u.displayName || u.username || 'user').slice(0, 3).join(', ')}`)
          : (selectedUsers[0]?.displayName || selectedUsers[0]?.username || selectedUsers[0]?.title || 'Chat');
        const ghost = await createGhostNoteChat(title, participantIds);
        toast.success(isGroup ? 'Discussion ready' : 'Discussion started');
        openConversation(ghost.$id, 'thread');
      } catch (error: any) {
        toast.error(formatSecureChatStartError(error, 'thread'));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Encrypted path — requires vault unlock + valid public keys
    const doEncryptedCreate = async () => {
      try {
        await ecosystemSecurity.ensureE2EIdentity(user.$id);
        const participantIds = [user.$id, ...selectedUsers.map((u) => u.id || (u as any).$id)];

        // Live discovery for every member — refuse if anyone not secure-ready (should already be auto-off, but double-check)
        const discoveries = await Promise.all(participantIds.map((id) => discoverRecipientSecureReady(id)));
        const missing = discoveries.find((d) => d.userId !== user.$id && !d.ready);
        if (missing) {
          const label = missing.profile?.displayName || missing.profile?.username || 'A member';
          throw new Error(`${label} hasn't set up secure chat yet. Turn off encryption to start a standard discussion.`);
        }

        if (isGroup) {
          const newConv = await ChatService.createConversation(participantIds, 'group', hangoutName.trim());
          toast.success('Hangout ready');
          openConversation(newConv.$id, 'chat');
        } else {
          const newConv = await ChatService.createConversation(participantIds, 'direct');
          toast.success('Secure chat ready');
          openConversation(newConv.$id, 'chat');
        }
      } catch (error: any) {
        toast.error(error?.message || 'Failed to create');
      } finally {
        setBusy(false);
      }
    };

    if (!ecosystemSecurity.status.isUnlocked) {
      setBusy(false);
      requestSudo({
        onSuccess: () => { void doEncryptedCreate(); },
        onCancel: () => setBusy(false),
      });
      return;
    }
    await doEncryptedCreate();
  }, [user, selectedUsers, hangoutName, encryptedEnabled, openConversation, requestSudo]);

  const isGroup = selectedUsers.length > 1;
  const canCreate = selectedUsers.length > 0 && !busy && (!isGroup || hangoutName.trim().length > 0 || !encryptedEnabled);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161412] text-white font-satoshi">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#34322F] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-[#0A0908] border border-[#34322F] text-[#F59E0B] shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black font-clash text-white tracking-tight truncate m-0">New hangout</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 m-0 mt-0.5 flex items-center gap-1">
              <Users size={10} className="text-white/30" />
              {isGroup ? `${selectedUsers.length + 1} people` : selectedUsers.length === 1 ? '1 person' : 'Add people to start'}
            </p>
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

      {/* E2E Toggle — single control merges chat/hangout tabs */}
      <div className="px-5 pt-4 shrink-0">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0A0908] border border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg border shrink-0 ${encryptedEnabled ? 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]' : 'bg-white/5 border-white/10 text-white/40'}`}>
              {encryptedEnabled ? <Lock size={16} /> : <Shield size={16} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white m-0">End-to-end encrypted</p>
              <p className="text-[10px] font-semibold text-white/35 m-0 leading-tight">
                {checkingKeys ? 'Checking keys…' : hasMissingKeys ? 'Off — someone lacks secure setup' : encryptedEnabled ? 'Messages stay private to participants' : 'Off — will create standard discussion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={encryptedEnabled}
            disabled={hasMissingKeys || !isUnlocked}
            onClick={() => {
              if (hasMissingKeys) {
                toast('Turn off encryption is automatic — a participant lacks secure setup', { id: 'e2e-disabled-reason' });
                return;
              }
              if (!isUnlocked && !encryptedEnabled) {
                requestSudo({ onSuccess: () => setUserToggledOff(false) });
                return;
              }
              setUserToggledOff((v) => !v);
            }}
            title={hasMissingKeys ? 'Disabled — participant without public key' : !isUnlocked ? 'Unlock vault to enable encryption' : encryptedEnabled ? 'Tap to turn off' : 'Tap to turn on'}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${encryptedEnabled ? 'bg-[#F59E0B] border-[#F59E0B]' : 'bg-white/10 border-white/10'} ${(hasMissingKeys || !isUnlocked) && !encryptedEnabled ? 'opacity-60' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${encryptedEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {!isUnlocked ? (
          <p className="text-[10px] font-semibold text-amber-400/80 mt-2 px-1">Vault locked — encryption will prompt unlock, or turn it off for a standard discussion.</p>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {isGroup ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45 font-mono block">
              Hangout name {encryptedEnabled ? '' : '(for discussion)'}
            </label>
            <input
              value={hangoutName}
              onChange={(e) => setHangoutName(e.target.value)}
              placeholder={encryptedEnabled ? 'e.g. Weekend crew' : 'e.g. Project sync'}
              className="w-full rounded-xl bg-[#0A0908] border border-[#34322F] px-4 py-3 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-[#F59E0B]/50"
            />
          </div>
        ) : null}

        <UserSearch
          label="ADD PEOPLE"
          placeholder="Search by name or @username"
          selectedUsers={selectedUsers}
          onSelect={(u) => {
            const id = u.id || (u as any).$id;
            if (selectedUsers.some((x) => (x.id || (x as any).$id) === id)) return;
            if (selectedUsers.length >= HANGOUT_MAX) {
              toast.error(`Up to ${HANGOUT_MAX} people besides you`);
              return;
            }
            // Optimistically add; key check effect will auto-disable encryption if needed
            setSelectedUsers((prev) => [...prev, u]);
          }}
          onRemove={(id) => setSelectedUsers((prev) => prev.filter((u) => (u.id || (u as any).$id) !== id))}
          multiple
          excludeIds={user?.$id ? [user.$id] : []}
          inlineResults={false}
        />

        {selectedUsers.length === 0 ? (
          <p className="text-center text-xs text-white/35 py-6 font-semibold">
            Add one person for a direct chat, or multiple for a hangout. {!encryptedEnabled ? 'Will create a discussion.' : 'Encrypted when possible.'}
          </p>
        ) : null}
        {hasMissingKeys ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex gap-2.5">
            <Shield size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-200/90 leading-relaxed m-0">
              One or more people haven&apos;t set up secure chat. Encryption is off — we&apos;ll create a standard discussion instead. Remove them or have them unlock vault in Settings to use encrypted hangouts.
            </p>
          </div>
        ) : null}
      </div>

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
          disabled={!canCreate}
          onClick={() => void handleCreate()}
          className="flex-1 h-12 rounded-xl bg-[#F59E0B] text-black font-extrabold text-sm disabled:opacity-40 hover:bg-amber-500 transition-colors"
        >
          {busy ? 'Creating…' : !encryptedEnabled ? (isGroup ? 'Create discussion' : 'Start discussion') : isGroup ? 'Create hangout' : 'Start chat'}
        </button>
      </div>
    </div>
  );
}
