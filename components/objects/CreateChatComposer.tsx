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
  // Unencrypted hangouts reuse same conversations/messages tables with isEncrypted=false (no key_mapping/epochs).
  // Toggle ON by default (transient); auto-off if user toggled off OR participant lacks X25519 key. For unencrypted, no vault/keys needed.
  const hasMissingKeys = missingKeyIds.size > 0;
  const [existingDirectInfo, setExistingDirectInfo] = useState<{ hasEncrypted: boolean; hasUnencrypted: boolean; checked: boolean }>({ hasEncrypted: false, hasUnencrypted: false, checked: false });
  const baseEncryptedEnabled = !userToggledOff && !hasMissingKeys;
  // Duplicate prevention: two people can have at most two directs (encrypted + unencrypted). Default to opposite if one exists, grey out if both.
  const isDirectForDup = selectedUsers.length === 1;
  const hasBothDirects = isDirectForDup && existingDirectInfo.checked && existingDirectInfo.hasEncrypted && existingDirectInfo.hasUnencrypted;
  const hasOneDirect = isDirectForDup && existingDirectInfo.checked && (existingDirectInfo.hasEncrypted !== existingDirectInfo.hasUnencrypted);
  const defaultOpposite = hasOneDirect ? !existingDirectInfo.hasEncrypted : baseEncryptedEnabled;
  const encryptedEnabled = hasBothDirects ? baseEncryptedEnabled : hasOneDirect ? defaultOpposite : baseEncryptedEnabled;
  const isToggleGreyed = hasBothDirects || hasOneDirect || hasMissingKeys;

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
      if (user?.$id) {
        const selfD = await discoverRecipientSecureReady(user.$id);
        if (!selfD.ready) missing.add(user.$id);
      }
      if (cancelled) return;
      setMissingKeyIds(missing);
      if (missing.size > 0 && isUnlocked && !userToggledOff) {
        const names = discoveries.filter((d) => missing.has(d.userId)).map((d) => d.profile?.displayName || d.profile?.username || 'Someone').join(', ');
        if (names) toast(`Encryption off — ${names} hasn't set up secure chat`, { id: 'e2e-auto-off' });
      }
    })().finally(() => {
      if (!cancelled) setCheckingKeys(false);
    });
    return () => { cancelled = true; };
  }, [selectedUsers, user?.$id, isUnlocked, userToggledOff]);

  // Existing direct duplicate check — defaults to opposite, greys out if both exist
  useEffect(() => {
    if (selectedUsers.length !== 1 || !user?.$id) {
      setExistingDirectInfo({ hasEncrypted: false, hasUnencrypted: false, checked: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const otherId = (selectedUsers[0] as any).id || (selectedUsers[0] as any).$id;
        const all = await ChatService.getConversations(user.$id);
        const directs = (all.rows || []).filter((c: any) => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(user.$id) && c.participants.includes(otherId) && c.participants.length === 2);
        const hasEncrypted = directs.some((c: any) => c.isEncrypted === true);
        const hasUnencrypted = directs.some((c: any) => !c.isEncrypted);
        if (!cancelled) setExistingDirectInfo({ hasEncrypted, hasUnencrypted, checked: true });
      } catch {
        if (!cancelled) setExistingDirectInfo({ hasEncrypted: false, hasUnencrypted: false, checked: true });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUsers, user?.$id]);

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

    // Duplicate prevention: direct can have at most encrypted+unencrypted. If both exist, show chooser.
    if (selectedUsers.length === 1 && existingDirectInfo.checked && existingDirectInfo.hasEncrypted && existingDirectInfo.hasUnencrypted) {
      try {
        const otherId = (selectedUsers[0] as any).id || (selectedUsers[0] as any).$id;
        const all = await ChatService.getConversations(user.$id);
        const directs = (all.rows || []).filter((c: any) => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(user.$id) && c.participants.includes(otherId) && c.participants.length === 2);
        toast('Both conversations already exist — choose one', { id: 'dup-both' });
        // Open the one matching current toggle, or first encrypted
        const preferred = directs.find((c: any) => !!c.isEncrypted === encryptedEnabled) || directs[0];
        if (preferred) openConversation(preferred.$id, 'chat');
      } catch {}
      return;
    }

    setBusy(true);
    const participantIds = [user.$id, ...selectedUsers.map((u) => u.id || (u as any).$id)];

    // Unencrypted — same conversations/messages tables, isEncrypted=false, no key_mapping/epochs, no vault needed
    if (!encryptedEnabled) {
      try {
        const newConv = await ChatService.createConversation(participantIds, isGroup ? 'group' : 'direct', isGroup ? hangoutName.trim() : undefined, { encrypted: false } as any);
        toast.success(isGroup ? 'Discussion ready' : 'Chat started');
        openConversation(newConv.$id, 'chat');
      } catch (error: any) {
        toast.error(formatSecureChatStartError(error, 'chat'));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Encrypted — requires vault unlock + valid public keys (transient toggle, no key_mapping for unencrypted)
    const doCreate = async (forceEncrypted: boolean) => {
      try {
        if (forceEncrypted) await ecosystemSecurity.ensureE2EIdentity(user.$id);
        const discoveries = await Promise.all(participantIds.map((id) => discoverRecipientSecureReady(id)));
        const missing = discoveries.find((d) => d.userId !== user.$id && !d.ready);
        if (forceEncrypted && missing) {
          const label = missing.profile?.displayName || missing.profile?.username || 'A member';
          throw new Error(`${label} hasn't set up secure chat yet. Turn off encryption to start a standard chat.`);
        }
        if (isGroup) {
          const newConv = await ChatService.createConversation(participantIds, 'group', hangoutName.trim(), { encrypted: forceEncrypted } as any);
          toast.success(forceEncrypted ? 'Hangout ready' : 'Discussion ready');
          openConversation(newConv.$id, 'chat');
        } else {
          const newConv = await ChatService.createConversation(participantIds, 'direct', undefined, { encrypted: forceEncrypted } as any);
          toast.success(forceEncrypted ? 'Secure chat ready' : 'Chat started');
          openConversation(newConv.$id, 'chat');
        }
      } catch (error: any) {
        toast.error(error?.message || 'Failed to create');
      } finally {
        setBusy(false);
      }
    };

    if (encryptedEnabled && !ecosystemSecurity.status.isUnlocked) {
      setBusy(false);
      requestSudo({
        onSuccess: () => { void doCreate(true); },
        onCancel: () => setBusy(false),
      });
      return;
    }
    await doCreate(encryptedEnabled);
  }, [user, selectedUsers, hangoutName, encryptedEnabled, existingDirectInfo, openConversation, requestSudo]);

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
            disabled={isToggleGreyed}
            onClick={() => {
              if (hasMissingKeys) {
                toast('Turn off encryption is automatic — a participant lacks secure setup', { id: 'e2e-disabled-reason' });
                return;
              }
              if (hasBothDirects || hasOneDirect) {
                toast(hasBothDirects ? 'Both encrypted and standard chats already exist — choose one' : `Only ${existingDirectInfo.hasEncrypted ? 'standard' : 'encrypted'} chat can be created — opposite of existing`, { id: 'dup-both-toggle' });
                return;
              }
              setUserToggledOff((v) => !v);
            }}
            title={hasMissingKeys ? 'Disabled — participant without public key' : hasBothDirects ? 'Greyed — both chat types already exist' : hasOneDirect ? `Greyed — opposite of existing (${existingDirectInfo.hasEncrypted ? 'standard' : 'encrypted'})` : encryptedEnabled ? 'Tap to turn off — will create unencrypted discussion' : 'Tap to turn on'}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${encryptedEnabled ? 'bg-[#F59E0B] border-[#F59E0B]' : 'bg-white/10 border-white/10'} ${isToggleGreyed ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${encryptedEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {encryptedEnabled && !isUnlocked ? (
          <p className="text-[10px] font-semibold text-amber-400/80 mt-2 px-1">Vault locked — creating encrypted hangout will prompt unlock.</p>
        ) : null}
        {!encryptedEnabled && hasMissingKeys ? (
          <p className="text-[10px] font-semibold text-white/35 mt-2 px-1">No conversation keys — standard chat uses same table with encryption off.</p>
        ) : null}
        {hasBothDirects ? (
          <p className="text-[10px] font-semibold text-white/35 mt-2 px-1">Both encrypted and standard chats already exist — choose one from your conversations.</p>
        ) : hasOneDirect ? (
          <p className="text-[10px] font-semibold text-white/35 mt-2 px-1">Defaults to {existingDirectInfo.hasEncrypted ? 'standard (unencrypted)' : 'encrypted'} — opposite of existing chat. Toggle greyed to prevent duplicate.</p>
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
