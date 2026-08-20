'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Lock,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import { useNostrFeed } from '@/hooks/useNostrFeed';
import { SocialService } from '@/lib/services/social';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import toast from 'react-hot-toast';

interface MomentComposerDrawerProps {
  onClose: () => void;
}

type PendingAttach = {
  id: string;
  label: string;
  kind: 'file' | 'object' | 'voice';
  url?: string;
};

/**
 * Bottom-sheet create moment — EventDialog gold standard:
 * starts at ~60dvh, expands to true `inset-0 h-[100dvh]` fullscreen (no top gap).
 */
export function MomentComposerDrawer({ onClose }: MomentComposerDrawerProps) {
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { publishPost } = useNostrFeed();
  const { openFileDrawer } = useUnifiedFileDrawer();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [syncToNostr, setSyncToNostr] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttach[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    void LocalEngine.cacheGet<boolean>('f_sync_to_nostr_pref').then((pref) => {
      if (pref !== null && pref !== undefined) setSyncToNostr(Boolean(pref));
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const persistSync = (next: boolean) => {
    setSyncToNostr(next);
    void LocalEngine.cacheSet('f_sync_to_nostr_pref', next);
  };

  const handleAttach = () => {
    openFileDrawer({
      title: 'Attach to moment',
      onSelectFile: (file) => {
        const isObject = file.mimeType === 'application/x-kylrix-object' || file.fileUrl?.startsWith('[[kylrix-object:');
        setAttachments((prev) => {
          if (prev.some((a) => a.id === file.$id)) return prev;
          return [
            ...prev,
            {
              id: file.$id,
              label: file.name || 'Attachment',
              kind: isObject ? 'object' : 'file',
              url: file.fileUrl,
            },
          ];
        });
        if (file.fileUrl && /^https?:\/\//.test(file.fileUrl) && !isObject) {
          setContent((c) => (c.includes(file.fileUrl!) ? c : `${c.trim()}\n${file.fileUrl}`.trim()));
        }
      },
    });
  };

  const stopRecordingTimers = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      stopRecordingTimers();
      return;
    }

    if (!isPro) {
      openProUpgrade('Voice recording');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options: MediaRecorderOptions = { audioBitsPerSecond: 16000 };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopRecordingTimers();
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        try {
          const uploaded = await StorageService.uploadFile(audioFile, 'voice');
          const viewUrl = StorageService.getFileView(uploaded.$id, 'voice').toString();
          setAttachments((prev) => [
            ...prev,
            {
              id: uploaded.$id,
              label: 'Voice note',
              kind: 'voice',
              url: viewUrl,
            },
          ]);
          toast.success('Voice note attached');
        } catch (err) {
          console.error(err);
          toast.error('Could not save voice note');
        }
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      toast.error('Microphone access is required for voice notes');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachments.length) return;
    if (!user?.$id) return;

    setPublishing(true);
    const mediaIds = attachments.map((a) => a.id);
    let body = content.trim();
    for (const a of attachments) {
      if (a.url && /^https?:\/\//.test(a.url) && !body.includes(a.url)) {
        body = `${body}\n${a.url}`.trim();
      }
    }
    const finalBody = body || 'Shared an update';
    const finalAttachments = attachments.length ? [...attachments] : null;
    const shouldSyncNostr = syncToNostr && !isVaultLocked && !!identity;

    // 1. Optimistic LocalEngine cache creation so user sees moment instantly in feed
    const tempId = `temp_moment_${Date.now()}`;
    const optimisticMoment: any = {
      $id: tempId,
      userId: user.$id,
      caption: finalBody,
      type: 'image',
      momentKind: 'post',
      sourceId: null,
      searchTitle: finalBody,
      fileId: JSON.stringify({ type: 'post' }),
      nostrId: null,
      attachments: finalAttachments,
      isPublic: true,
      isGuest: true,
      $createdAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    void (async () => {
      try {
        const cachedMoments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
        await LocalEngine.cacheSet('f_moments_list', [optimisticMoment, ...cachedMoments]);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kylrix:moment-created', { detail: optimisticMoment }));
        }
      } catch {}
    })();

    // 2. Instant UI feedback & dismissal (0ms UI lag)
    toast.success('Publishing moment in background...');
    setContent('');
    setAttachments([]);
    setPublishing(false);
    onClose();

    // 3. Background execution pipeline for Nostr broadcast and remote TablesDB persistence
    void (async () => {
      let nostrId: string | null = null;
      let nostrSynced = false;

      if (shouldSyncNostr) {
        try {
          const nostrRes = await publishPost(finalBody);
          if (nostrRes && typeof nostrRes === 'object' && nostrRes.success && nostrRes.eventId) {
            nostrId = nostrRes.eventId;
            nostrSynced = true;
          } else if (nostrRes === true as any) {
            nostrSynced = true;
          }
        } catch (nostrErr) {
          console.warn('[MomentComposer] Background Nostr sync warning:', nostrErr);
        }
      }

      try {
        const createdMoment = await SocialService.createMoment(
          user.$id,
          finalBody,
          'post',
          mediaIds,
          'public',
          undefined,
          undefined,
          undefined,
          undefined,
          null,
          nostrId,
          finalAttachments,
        );

        if (createdMoment) {
          const cachedMoments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
          const updated = [
            createdMoment,
            ...cachedMoments.filter((m: any) => m.$id !== tempId && m.$id !== createdMoment.$id),
          ];
          await LocalEngine.cacheSet('f_moments_list', updated);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kylrix:moment-created', { detail: createdMoment }));
          }
        }

        toast.success(
          nostrSynced
            ? 'Moment published to Kylrix and Nostr!'
            : 'Moment published to your feed!',
        );
      } catch (remoteErr) {
        console.error('[MomentComposer] Background publish error:', remoteErr);
        toast.error('Failed to sync moment to remote server.');
      }
    })();
  };

  if (!mounted) return null;

  const canPost = Boolean(content.trim() || attachments.length);

  const sheet = (
    <div className="fixed inset-0 z-[10000] flex justify-center overflow-hidden pointer-events-none">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 transition-opacity duration-300 pointer-events-auto"
        onClick={onClose}
      />

      <div
        className={`fixed bg-[#161412] border-[#34322F] pointer-events-auto transition-all duration-300 flex flex-col z-[10000] ${
          isExpanded
            ? 'inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none border-0'
            : 'inset-x-0 bottom-0 h-[60dvh] max-h-[60dvh] border-t rounded-t-[28px] w-full max-w-[720px] left-1/2 -translate-x-1/2'
        }`}
      >
        <div className="p-5 pb-3 flex items-center justify-between border-b border-[#34322F] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#0A0908] border border-[#34322F] text-[#F59E0B] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
              Create moment
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-[#F5F2ED] hover:bg-[#0A0908] transition-colors cursor-pointer"
              aria-label={isExpanded ? 'Collapse' : 'Expand fullscreen'}
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8E8A86] hover:text-white hover:bg-[#0A0908] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>



        <form
          onSubmit={handlePublish}
          className="flex-1 min-h-0 flex flex-col p-5 pt-3 gap-3 overflow-hidden"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className={`w-full flex-1 min-h-[100px] bg-transparent border-none text-white text-[17px] leading-relaxed focus:outline-none resize-none placeholder:text-white/30 font-satoshi ${
              isExpanded ? 'text-xl' : ''
            }`}
            autoFocus
          />

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 shrink-0">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[11px] font-bold text-white/70"
                >
                  {a.label}
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    className="text-white/40 hover:text-white"
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {/* Sync to Nostr — preference row (LocalEngine); vault-gated */}
          <div className="rounded-xl bg-[#0A0908] border border-white/[0.06] p-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-2 rounded-lg border ${
                  syncToNostr && !isVaultLocked
                    ? 'bg-[#161412] border-[#F59E0B]/30 text-[#F59E0B]'
                    : 'bg-[#161412] border-white/[0.06] text-white/40'
                }`}
              >
                <Globe size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">Sync to Nostr</p>
                {isVaultLocked ? (
                  <p className="text-[10px] font-bold text-[#F59E0B]/90 flex items-center gap-1 mt-0.5">
                    <Lock size={10} /> Unlock vault to sync to Nostr
                  </p>
                ) : (
                  <p className="text-[10px] text-white/40 mt-0.5">Also post to public relays</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isVaultLocked ? (
                <button
                  type="button"
                  onClick={() => void unlockAndLoad()}
                  className="px-2 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-bold"
                >
                  Unlock
                </button>
              ) : null}
              <button
                type="button"
                role="switch"
                aria-checked={syncToNostr}
                disabled={isVaultLocked}
                onClick={() => {
                  if (isVaultLocked) return;
                  persistSync(!syncToNostr);
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  syncToNostr ? 'bg-[#F59E0B]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    syncToNostr ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#34322F] flex-shrink-0">
            <button
              type="button"
              onClick={handleAttach}
              className="p-2.5 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/60 hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-colors"
              title="Attach object"
              aria-label="Attach object"
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              onClick={() => void toggleRecording()}
              className={`p-2.5 rounded-xl border transition-colors ${
                isRecording
                  ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : 'bg-[#0A0908] border-white/[0.06] text-white/60 hover:text-white'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice note'}
              aria-label="Voice note"
            >
              {isRecording ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold font-mono">
                  <Square size={14} className="fill-current" />
                  {Math.floor(recordingDuration / 60)}:
                  {(recordingDuration % 60 < 10 ? '0' : '') + (recordingDuration % 60)}
                </span>
              ) : (
                <Mic size={18} />
              )}
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-bold text-white/45 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={publishing || !canPost}
              className="px-5 py-2.5 bg-[#F59E0B] hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl transition-all flex items-center gap-2"
            >
              {publishing ? (
                <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
              ) : (
                <Send size={16} />
              )}
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
