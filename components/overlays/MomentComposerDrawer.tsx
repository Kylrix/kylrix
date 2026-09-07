'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  loadMomentAgentPref,
  saveMomentAgentPref,
  useMomentIntelligence,
} from '@/hooks/useMomentIntelligence';
import { TypeIntelGhostLayer } from '@/components/agentic/TypeIntelBar';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
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

export type MomentComposerMode = 'create' | 'reply';

/**
 * Bottom-sheet create / reply moment — EventDialog gold standard:
 * starts at ~60dvh, expands to true `inset-0 h-[100dvh]` fullscreen (no top gap).
 * Reply mode reuses the same Kylie assist layer so posts and replies train the same voice.
 */
export function MomentComposerDrawer({ onClose }: MomentComposerDrawerProps) {
  const { drawerData } = useUnifiedDrawer();
  const mode: MomentComposerMode = drawerData?.mode === 'reply' ? 'reply' : 'create';
  const parentMomentId = mode === 'reply' ? String(drawerData?.parentMomentId || '').trim() : '';
  const replySource = (drawerData?.source === 'nostr' ? 'nostr' : 'ecosystem') as 'nostr' | 'ecosystem';
  const parentSnippet = String(drawerData?.parentSnippet || '').trim();
  const replyRootPubkey = drawerData?.rootPubkey ? String(drawerData.rootPubkey) : undefined;
  const replyNostrId = drawerData?.nostrId ? String(drawerData.nostrId) : undefined;

  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const { publishPost } = useNostrFeed();
  const { openFileDrawer } = useUnifiedFileDrawer();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [syncToNostr, setSyncToNostr] = useState(false);
  const [createWithAgent, setCreateWithAgent] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttach[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openPro = useCallback(() => openProUpgrade('Kylie Assist'), [openProUpgrade]);

  const {
    learningStatus,
    suggestion,
    busy: agentBusy,
    acceptSuggestion,
    runTakeover,
    flushReinforce,
  } = useMomentIntelligence({
    userId: user?.$id,
    displayName: user?.name || user?.email || undefined,
    draft: content,
    enabled: createWithAgent,
    isPro,
    onOpenPro: openPro,
    setDraft: setContent,
    mode,
    parentSnippet,
    parentMomentId,
  });

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      flushReinforce();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [flushReinforce]);

  useEffect(() => {
    void LocalEngine.cacheGet<boolean>('f_sync_to_nostr_pref').then((pref) => {
      if (pref !== null && pref !== undefined) setSyncToNostr(Boolean(pref));
    });
    void loadMomentAgentPref().then(setCreateWithAgent);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Tab' || (e.key === 'ArrowRight' && e.metaKey)) && suggestion) {
        e.preventDefault();
        acceptSuggestion();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, suggestion, acceptSuggestion]);

  const persistSync = (next: boolean) => {
    setSyncToNostr(next);
    void LocalEngine.cacheSet('f_sync_to_nostr_pref', next);
  };

  const persistAgent = (next: boolean) => {
    if (next && !isPro) {
      openPro();
      return;
    }
    setCreateWithAgent(next);
    void saveMomentAgentPref(next);
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
    if (!user?.$id && mode !== 'reply') return;
    if (mode === 'reply' && replySource === 'ecosystem' && !user?.$id) return;

    flushReinforce();
    setPublishing(true);
    const mediaIds = attachments.map((a) => a.id);
    let body = content.trim();
    for (const a of attachments) {
      if (a.url && /^https?:\/\//.test(a.url) && !body.includes(a.url)) {
        body = `${body}\n${a.url}`.trim();
      }
    }
    const finalBody = body || (mode === 'reply' ? '' : 'Shared an update');
    if (!finalBody.trim()) {
      setPublishing(false);
      return;
    }
    const finalAttachments = attachments.length ? [...attachments] : null;
    const shouldSyncNostr = syncToNostr && !isVaultLocked && !!identity;

    // ── Reply path: same drawer + Kylie assist, posts via engagement API ──
    if (mode === 'reply' && parentMomentId) {
      if (replySource === 'nostr' && (isVaultLocked || !identity)) {
        toast.error('Unlock vault to reply on Nostr');
        void unlockAndLoad();
        setPublishing(false);
        return;
      }

      const text = finalBody;
      setContent('');
      setAttachments([]);
      setPublishing(false);
      onClose();
      toast.success('Sending reply…');

      void (async () => {
        try {
          const words = `${text} ${parentSnippet}`.toLowerCase().match(/#?\w{3,}/g) || [];
          const topics = Array.from(new Set(words.slice(0, 10)));
          void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) =>
            recordFeedInteraction({ topics, searchWeight: 3, isConsciousAction: true }),
          );

          const { createMomentComment } = await import('@/lib/connect/moment-engagement');
          const created = await createMomentComment({
            source: replySource,
            id: parentMomentId,
            content: text,
            userId: user?.$id,
            privateKeyBytes: identity?.privateKeyBytes,
            nsec: identity?.nsec,
            rootPubkey: replyRootPubkey,
            nostrId: replyNostrId,
          });

          // Seed voice twin with reply text (social layer learning)
          if (user?.$id && createWithAgent) {
            try {
              const cachedMoments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
              const replyRow = {
                $id: created?.id || `temp_reply_${Date.now()}`,
                userId: user.$id,
                caption: text,
                momentKind: 'reply',
                sourceId: parentMomentId,
                $createdAt: new Date().toISOString(),
              };
              await LocalEngine.cacheSet('f_moments_list', [replyRow, ...cachedMoments]);
              void import('@/lib/agentic/moment-doppelganger-local').then((m) =>
                m.refreshMomentDoppelgangerVoice(user.$id),
              );
            } catch {}
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kylrix:moment-reply-created', {
                detail: { parentMomentId, comment: created, content: text },
              }),
            );
          }
          toast.success('Reply posted');
        } catch (err) {
          console.error('[MomentComposer] Reply failed:', err);
          toast.error('Could not post reply');
        }
      })();
      return;
    }

    if (!user?.$id) {
      setPublishing(false);
      return;
    }

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

    toast.success('Publishing moment in background...');
    setContent('');
    setAttachments([]);
    setPublishing(false);
    onClose();

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
          // Cache own Nostr voice samples for doppelganger
          try {
            const key = `f_nostr_voice_samples_${user.$id}`;
            const prev = (await LocalEngine.cacheGet<any[]>(key)) || [];
            await LocalEngine.cacheSet(key, [
              { text: finalBody, at: new Date().toISOString(), nostrId },
              ...(Array.isArray(prev) ? prev : []),
            ].slice(0, 40));
          } catch {}
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
          if (createWithAgent) {
            void import('@/lib/agentic/moment-doppelganger-local').then((m) =>
              m.refreshMomentDoppelgangerVoice(user.$id),
            );
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
  const headerTitle = mode === 'reply' ? 'Reply' : 'Create moment';
  const placeholder =
    mode === 'reply'
      ? parentSnippet
        ? `Reply to “${parentSnippet.slice(0, 48)}${parentSnippet.length > 48 ? '…' : ''}”`
        : 'Write your reply…'
      : "What's happening?";
  const sendLabel = mode === 'reply' ? 'Reply' : 'Post';
  const learningLabel =
    learningStatus === 'initializing'
      ? 'Kylie is getting ready…'
      : learningStatus === 'ready'
        ? mode === 'reply'
          ? 'Kylie is learning from your posts & replies'
          : 'Kylie is learning from your posts'
        : learningStatus === 'empty'
          ? 'Kylie assist ready — will learn as you write'
          : null;

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
            <div className="p-2 rounded-xl bg-[#000000] border border-white/20 text-[#F59E0B] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight">
              {headerTitle}
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
          <div className="relative flex-1 min-h-[100px] flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (
                  createWithAgent &&
                  suggestion &&
                  (e.key === 'ArrowRight' || e.key === 'Tab') &&
                  e.currentTarget.selectionStart === e.currentTarget.value.length
                ) {
                  e.preventDefault();
                  acceptSuggestion();
                }
              }}
              placeholder={suggestion ? '' : placeholder}
              className={`relative w-full flex-1 min-h-[100px] bg-transparent border-none text-white leading-relaxed focus:outline-none resize-none placeholder:text-white/30 font-satoshi caret-[#F59E0B] ${
                isExpanded ? 'text-xl' : 'text-[17px]'
              }`}
              autoFocus
            />
            <TypeIntelGhostLayer
              draft={content}
              suggestion={suggestion}
              enabled={createWithAgent}
              showWand={createWithAgent}
              busy={agentBusy}
              accent="#F59E0B"
              onAccept={acceptSuggestion}
              onTakeover={() => void runTakeover()}
              className={`font-satoshi leading-relaxed ${isExpanded ? 'text-xl' : 'text-[17px]'}`}
            />
          </div>

          {createWithAgent && learningLabel ? (
            <p className="text-[10px] font-bold text-white/40 flex items-center gap-1.5 shrink-0 -mt-1">
              {learningStatus === 'initializing' ? (
                <span className="w-2.5 h-2.5 rounded-full border border-[#F59E0B]/40 border-t-[#F59E0B] animate-spin" />
              ) : (
                <Sparkles size={11} className="text-[#F59E0B]/70" />
              )}
              <span>{learningLabel}</span>
              {agentBusy ? <span className="text-white/25">· writing…</span> : null}
            </p>
          ) : null}

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 shrink-0">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] border border-white/20 text-[11px] font-bold text-white"
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

          {/* Compact toggles: Nostr sync (create only) + Kylie assist */}
          <div className={`grid gap-2 shrink-0 ${mode === 'reply' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {mode !== 'reply' ? (
            <div className="rounded-xl bg-[#000000] border border-white/20 p-2.5 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Globe
                  size={14}
                  className={syncToNostr && !isVaultLocked ? 'text-[#F59E0B] shrink-0' : 'text-white/40 shrink-0'}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-white truncate">Nostr sync</p>
                  {isVaultLocked ? (
                    <button
                      type="button"
                      onClick={() => void unlockAndLoad()}
                      className="text-[9px] font-bold text-[#F59E0B] flex items-center gap-0.5"
                    >
                      <Lock size={9} /> Unlock
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={syncToNostr}
                disabled={isVaultLocked}
                onClick={() => {
                  if (isVaultLocked) return;
                  persistSync(!syncToNostr);
                }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-40 ${
                  syncToNostr ? 'bg-[#F59E0B]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    syncToNostr ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            ) : null}

            <div className="rounded-xl bg-[#000000] border border-white/20 p-2.5 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles
                  size={14}
                  className={createWithAgent ? 'text-[#F59E0B] shrink-0' : 'text-white/40 shrink-0'}
                />
                <p className="text-[11px] font-extrabold text-white truncate">Kylie assist</p>
                {!isPro && !createWithAgent ? (
                  <span className="text-[8px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/25 shrink-0">
                    Pro
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={createWithAgent}
                onClick={() => persistAgent(!createWithAgent)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                  createWithAgent ? 'bg-[#F59E0B]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    createWithAgent ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#34322F] flex-shrink-0">
            <button
              type="button"
              onClick={handleAttach}
              className="p-2.5 rounded-xl bg-[#000000] border border-white/20 text-white/60 hover:text-[#F59E0B] hover:border-[#F59E0B]/40 transition-colors"
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
                  : 'bg-[#000000] border border-white/20 text-white/60 hover:text-white'
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
              {sendLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
