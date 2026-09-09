'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, MessageSquare, Radio, Shield, Users, X } from 'lucide-react';
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
  // Extra Nostr DM protocol toggle — enabled by default if search input was a Nostr public key (npub)
  const [sendViaNostr, setSendViaNostr] = useState(false);

  const isUnlocked = ecosystemSecurity.status.isUnlocked;
  // Unencrypted hangouts reuse same conversations/messages tables with isEncrypted=false (no key_mapping/epochs).
  const hasMissingKeys = missingKeyIds.size > 0;
  const [existingDirectInfo, setExistingDirectInfo] = useState<{ hasEncrypted: boolean; hasUnencrypted: boolean; checked: boolean }>({ hasEncrypted: false, hasUnencrypted: false, checked: false });
  const baseEncryptedEnabled = !userToggledOff && !hasMissingKeys;
  // Duplicate prevention: two people can have at most two directs (encrypted + unencrypted).
  const isDirectForDup = selectedUsers.length === 1;
  const hasBothDirects = isDirectForDup && existingDirectInfo.checked && existingDirectInfo.hasEncrypted && existingDirectInfo.hasUnencrypted;
  const hasOneDirect = isDirectForDup && existingDirectInfo.checked && (existingDirectInfo.hasEncrypted !== existingDirectInfo.hasUnencrypted);
  
  const isImpossibleDirect = isDirectForDup && existingDirectInfo.checked && existingDirectInfo.hasUnencrypted && hasMissingKeys;

  const targetEncrypted = hasOneDirect ? !existingDirectInfo.hasEncrypted : baseEncryptedEnabled;
  const encryptedEnabled = hasBothDirects || isImpossibleDirect ? false : (hasOneDirect ? targetEncrypted && !hasMissingKeys : baseEncryptedEnabled);
  const isToggleGreyed = hasBothDirects || hasOneDirect || hasMissingKeys || isImpossibleDirect;

  const isNostrOnlyUser = selectedUsers.length === 1 && Boolean(selectedUsers[0]?.isNostrOnly);
  const isViaNpubSearch = selectedUsers.length > 0 && selectedUsers.some((u) => u.viaNpub || u.isNostrOnly);

  useEffect(() => {
    onRegisterClose?.(() => onClose());
  }, [onClose, onRegisterClose]);

  // Auto-opt to send via Nostr if search method was a Nostr public key (npub) or recipient is external Nostr-only
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setSendViaNostr(false);
      return;
    }
    if (isViaNpubSearch || isNostrOnlyUser) {
      setSendViaNostr(true);
    } else {
      setSendViaNostr(false);
    }
  }, [selectedUsers, isViaNpubSearch, isNostrOnlyUser]);

  // Re-evaluate readiness whenever selection changes — auto-off encryption if needed
  useEffect(() => {
    if (selectedUsers.length === 0) {
      setMissingKeyIds(new Set());
      return;
    }
    let cancelled = false;
    setCheckingKeys(true);
    (async () => {
      const resolveUserId = (u: any) => u?.contactUserId || u?.userId || u?.targetUserId || u?.id || u?.$id;
      const ids = selectedUsers.map((u) => resolveUserId(u)).filter(Boolean);
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

  // Existing direct duplicate check
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
    (id: string, kind: 'chat' | 'thread' = 'chat', title?: string) => {
      onClose();
      openCommObjectDetail({
        conversationId: id,
        kind,
        title,
        openSidebar,
        openOverlay,
        closeSidebar,
        closeOverlay,
      });
    },
    [onClose, openSidebar, openOverlay, closeSidebar, closeOverlay],
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

    // Nostr DM Routing
    if (sendViaNostr || isNostrOnlyUser) {
      setBusy(true);
      try {
        const target = selectedUsers[0];
        let pubkeyHex = target?.nostrPubkeyHex || target?.id || target?.$id;
        if (target?.nostrNpub || (typeof pubkeyHex === 'string' && pubkeyHex.startsWith('npub1'))) {
          const { npubToBytes, bytesToHex } = await import('@/lib/nostr/crypto');
          try {
            pubkeyHex = bytesToHex(npubToBytes(target.nostrNpub || pubkeyHex));
          } catch {}
        }
        const conversationId = `nostr_dm_${pubkeyHex}`;
        const recipientTitle = target.title || target.displayName || target.username || 'Nostr DM';

        toast.success('Nostr DM hangout ready');
        openConversation(conversationId, 'chat', recipientTitle);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to start Nostr DM');
      } finally {
        setBusy(false);
      }
      return;
    }

    const isGroup = selectedUsers.length > 1;
    if (isGroup && !hangoutName.trim() && encryptedEnabled) {
      toast.error('Name your hangout');
      return;
    }

    // Duplicate prevention for Kylrix direct chats
    if (selectedUsers.length === 1 && existingDirectInfo.checked && (hasBothDirects || isImpossibleDirect)) {
      try {
        const otherId = (selectedUsers[0] as any).id || (selectedUsers[0] as any).$id;
        const all = await ChatService.getConversations(user.$id);
        const directs = (all.rows || []).filter((c: any) => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(user.$id) && c.participants.includes(otherId) && c.participants.length === 2);
        if (isImpossibleDirect) {
          toast.error('Standard chat already exists, and this participant has not set up secure chat yet.', { id: 'dup-impossible' });
          const existingUnenc = directs.find((c: any) => !c.isEncrypted);
          if (existingUnenc) openConversation(existingUnenc.$id, 'chat');
          return;
        }
        toast('Both conversations already exist — choose one', { id: 'dup-both' });
        const preferred = directs.find((c: any) => !!c.isEncrypted === encryptedEnabled) || directs[0];
        if (preferred) openConversation(preferred.$id, 'chat');
      } catch {}
      return;
    }

    setBusy(true);
    const resolveUserId = (u: any) => u?.contactUserId || u?.userId || u?.targetUserId || u?.id || u?.$id;
    const participantIds = [user.$id, ...selectedUsers.map((u) => resolveUserId(u)).filter(Boolean)];

    // Unencrypted hangout — Kylrix traditional system
    if (!encryptedEnabled) {
      try {
        const newConv = await ChatService.createConversation(participantIds, isGroup ? 'group' : 'direct', isGroup ? hangoutName.trim() : undefined, { encrypted: false } as any);
        toast.success(isGroup ? 'Hangout ready' : 'Hangout ready');
        openConversation(newConv.$id, 'chat');
      } catch (error: any) {
        toast.error(formatSecureChatStartError(error, 'thread'));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Encrypted — Kylrix traditional system
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
          toast.success('Hangout ready');
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
  }, [user, selectedUsers, sendViaNostr, isNostrOnlyUser, hangoutName, encryptedEnabled, existingDirectInfo, hasBothDirects, isImpossibleDirect, openConversation, requestSudo]);

  const isGroup = selectedUsers.length > 1;
  const canCreate = selectedUsers.length > 0 && !busy && (sendViaNostr || isNostrOnlyUser || (!hasBothDirects && !isImpossibleDirect && (!isGroup || hangoutName.trim().length > 0 || !encryptedEnabled)));

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

      {/* Nostr Protocol Toggle Row — appears when recipient is selected */}
      {selectedUsers.length > 0 ? (
        <div className="px-5 pt-4 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0A0908] border border-purple-500/20 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg border shrink-0 ${sendViaNostr ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                <Radio size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white m-0 flex items-center gap-1.5">
                  <span>Send via Nostr Protocol</span>
                  {isViaNpubSearch ? (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Default (npub input)</span>
                  ) : null}
                </p>
                <p className="text-[10px] font-semibold text-white/40 m-0 leading-tight">
                  {isNostrOnlyUser
                    ? 'External Nostr user — will send directly via Nostr DM protocol'
                    : sendViaNostr
                    ? 'Send via Nostr DM protocol'
                    : 'Disabled — will use Kylrix traditional hangouts system'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sendViaNostr}
              disabled={isNostrOnlyUser}
              onClick={() => setSendViaNostr((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${sendViaNostr ? 'bg-purple-600 border-purple-500' : 'bg-white/10 border-white/10'} ${isNostrOnlyUser ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${sendViaNostr ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {!sendViaNostr ? (
            /* E2E Toggle for Kylrix Traditional Hangouts */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0A0908] border border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg border shrink-0 ${encryptedEnabled ? 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  {encryptedEnabled ? <Lock size={16} /> : <Shield size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white m-0">End-to-end encrypted</p>
                  <p className="text-[10px] font-semibold text-white/35 m-0 leading-tight">
                    {checkingKeys ? 'Checking keys…' : isImpossibleDirect ? 'Cannot create — standard chat exists and participant lacks encryption' : hasMissingKeys ? 'Off — someone lacks secure setup' : encryptedEnabled ? 'Messages stay private to participants' : 'Off — will create standard hangout'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={encryptedEnabled}
                disabled={isToggleGreyed}
                onClick={() => {
                  if (isImpossibleDirect) {
                    toast('Standard chat already exists, and this participant has not set up secure chat yet.', { id: 'e2e-impossible-reason' });
                    return;
                  }
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
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${encryptedEnabled ? 'bg-[#F59E0B] border-[#F59E0B]' : 'bg-white/10 border-white/10'} ${isToggleGreyed ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${encryptedEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {isGroup && !sendViaNostr ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/45 font-mono block">
              Hangout name {encryptedEnabled ? '' : '(unencrypted)'}
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
          placeholder="Search by name, @username, or npub..."
          selectedUsers={selectedUsers}
          onSelect={(u) => {
            const id = u.id || (u as any).$id;
            if (selectedUsers.some((x) => (x.id || (x as any).$id) === id)) return;
            if (selectedUsers.length >= HANGOUT_MAX) {
              toast.error(`Up to ${HANGOUT_MAX} people besides you`);
              return;
            }
            setSelectedUsers((prev) => [...prev, u]);
          }}
          onRemove={(id) => setSelectedUsers((prev) => prev.filter((u) => (u.id || (u as any).$id) !== id))}
          multiple
          excludeIds={user?.$id ? [user.$id] : []}
          inlineResults={false}
        />

        {selectedUsers.length === 0 ? (
          <p className="text-center text-xs text-white/35 py-6 font-semibold">
            Add a person by username or Nostr npub to start a hangout.
          </p>
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
          {busy ? 'Creating…' : sendViaNostr ? 'Start Nostr DM' : isImpossibleDirect ? 'Chat exists' : hasBothDirects ? 'Both exist' : isGroup ? 'Create hangout' : 'Start hangout'}
        </button>
      </div>
    </div>
  );
}
