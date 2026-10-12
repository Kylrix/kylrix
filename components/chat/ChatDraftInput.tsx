'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Mic, Square, Send, Loader2, X } from 'lucide-react';
import { PresenceService } from '@/lib/services/presence';
import { toast } from 'react-hot-toast';
import type { ChatPendingObject } from '@/lib/chat/pending-object';
import { ChatObjectPreview } from '@/components/chat/ChatObjectPreview';

type Props = {
  attachment: File | null;
  pendingObject?: ChatPendingObject | null;
  sending: boolean;
  isRecording: boolean;
  enableMentions?: boolean;
  mentionTargets?: Array<{ id: string; label: string; token: string }>;
  onAttach: (event: React.MouseEvent<HTMLElement>) => void;
  attachmentDisabled?: boolean;
  onUpgradeRequested: () => void;
  onSend: (text: string) => Promise<boolean>;
  onToggleRecording: () => void;
  onClearAttachment?: () => void;
  onClearPendingObject?: () => void;
  typingUsers: string[];
  conversationId: string;
  typingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  canBroadcastTyping?: boolean;
  isDirect?: boolean;
};

/**
 * OpenBricks chat composer — single seamless bar (Telegram/Discord feel).
 * Icons sit inside one surface; no boxy chrome buttons.
 */
export const ChatDraftInput = React.memo(function ChatDraftInput({
  attachment,
  pendingObject = null,
  sending,
  isRecording,
  onAttach,
  attachmentDisabled = false,
  onUpgradeRequested,
  onSend,
  onToggleRecording,
  onClearAttachment,
  onClearPendingObject,
  typingUsers,
  conversationId,
  typingTimeoutRef,
  canBroadcastTyping = true,
  isDirect = true,
}: Props) {
  const [draft, setDraft] = useState('');
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = Boolean(draft.trim() || attachment || pendingObject) && !sending;

  const submitDraft = useCallback(async () => {
    if (!canSend && !isRecording) return;
    const didSend = await onSend(draft);
    if (didSend) setDraft('');
  }, [canSend, isRecording, draft, onSend]);

  const resize = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    resize();

    if (!conversationId || !isDirect || !canBroadcastTyping) return;
    // Ephemeral typing via Appwrite presence — no DB writes, muted for groups or when privacy off (mutual)
    try {
      const uid = typeof window !== 'undefined' ? (document as any).__kylrix_userId || '' : '';
      PresenceService.broadcastState(PresenceService.getChatChannel(conversationId), {
        state: 'typing' as any,
        // @ts-ignore metadata for typing
        metadata: { typing: true, userId: uid },
        activity: 'typing',
      } as any);
    } catch {}
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      try {
        PresenceService.broadcastState(PresenceService.getChatChannel(conversationId), {
          state: 'online' as any,
          // @ts-ignore
          metadata: { typing: false },
          activity: 'viewing',
        } as any);
      } catch {}
    }, 3000);
  };

  const onKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const val = draft.trim();
      if (!val) {
        toast.error('Type a message first to secure it.');
        return;
      }
      setDraft('Securing message...');
      try {
        const { AppwriteService } = await import('@/lib/appwrite');
        const { encryptThreadData } = await import('@/lib/encryption/thread-crypto');
        const threadSecret =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-send`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const titleEnc = await encryptThreadData('Secure Note');
        const contentEnc = await encryptThreadData(val, titleEnc.key);
        const note = await AppwriteService.createSendthreadObject({
          title: titleEnc.encrypted,
          content: contentEnc.encrypted,
          format: 'markdown',
          threadSecret,
          expiresAt,
          isEncrypted: true,
          sendObject: { kind: 'note' },
        });
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/idea/${note.$id}/${titleEnc.key}`;
        try {
          const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
          localStorage.setItem(
            'kylrix_send_sparks',
            JSON.stringify([
              { id: note.$id, kind: 'note', title: 'Secure Note', url, expiresAt },
              ...existing,
            ]),
          );
        } catch {
          /* ignore */
        }
        setDraft(url);
        toast.success('Message secured');
      } catch (err) {
        console.error('Failed to secure message:', err);
        setDraft(val);
        toast.error('Failed to secure message.');
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitDraft();
    }
  };

  const typingLabel =
    typingUsers.length === 0
      ? null
      : typingUsers.length === 1
        ? 'Someone is typing…'
        : `${typingUsers.length} people typing…`;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {typingLabel ? (
        <p className="m-0 px-3 text-[10px] font-bold uppercase tracking-wider text-white/35 font-mono">
          {typingLabel}
        </p>
      ) : null}

      {pendingObject ? (
        <ChatObjectPreview payload={pendingObject.payload} onRemove={onClearPendingObject} />
      ) : null}

      {attachment ? (
        <div className="mx-1 flex items-center gap-2 rounded-xl bg-[#0A0908] border border-white/[0.06] px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80 font-satoshi">
            {attachment.name}
          </span>
          {onClearAttachment ? (
            <button
              type="button"
              onClick={onClearAttachment}
              className="shrink-0 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"
              aria-label="Remove attachment"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`flex items-end gap-0.5 rounded-[22px] bg-[#161412] border border-white/[0.06] pl-1.5 pr-1.5 py-1.5 transition-[border-color] focus-within:border-[#F59E0B]/45 ${
          isRecording ? 'border-[#EF4444]/50' : ''
        }`}
      >
        <button
          type="button"
          onClick={attachmentDisabled ? onUpgradeRequested : onAttach}
          aria-label="Attach"
          title={attachmentDisabled ? 'Upgrade to attach' : 'Attach'}
          className={`shrink-0 w-9 h-9 mb-0.5 rounded-full inline-flex items-center justify-center transition-colors ${
            attachmentDisabled
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Paperclip size={18} strokeWidth={2} />
        </button>

        <textarea
          ref={textRef}
          rows={1}
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={isRecording ? 'Recording…' : 'Message'}
          disabled={isRecording}
          className="flex-1 min-w-0 max-h-[120px] resize-none bg-transparent border-0 outline-none shadow-none ring-0 focus:ring-0 focus:outline-none text-[0.9375rem] leading-[1.45] text-white font-satoshi font-medium placeholder:text-white/30 py-2 px-1.5 disabled:opacity-50"
          style={{ height: 'auto' }}
        />

        <button
          type="button"
          onClick={onToggleRecording}
          aria-label={isRecording ? 'Stop recording' : 'Voice note'}
          className={`shrink-0 w-9 h-9 mb-0.5 rounded-full inline-flex items-center justify-center transition-colors ${
            isRecording
              ? 'text-[#EF4444] bg-[#EF4444]/15 hover:bg-[#EF4444]/25'
              : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          {isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={18} strokeWidth={2} />}
        </button>

        <button
          type="button"
          onClick={() => void submitDraft()}
          disabled={!canSend}
          aria-label="Send"
          className={`shrink-0 w-9 h-9 mb-0.5 rounded-full inline-flex items-center justify-center transition-colors ${
            canSend
              ? 'bg-[#F59E0B] text-black hover:bg-[#FBBF24]'
              : 'text-white/20'
          }`}
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
          ) : (
            <Send size={16} strokeWidth={2.5} className={canSend ? 'translate-x-[1px]' : ''} />
          )}
        </button>
      </div>
    </div>
  );
});
