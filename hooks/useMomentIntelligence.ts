'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  refreshMomentDoppelgangerVoice,
} from '@/lib/agentic/moment-doppelganger-local';
import type { MomentVoiceSample } from '@/lib/agentic/prompts/moment-doppelganger';
import {
  completeOfflineSuffix,
  pickCompletionSource,
  recordAiInference,
  suggestOfflineReply,
} from '@/lib/agentic/offline-complete';
import { asSuggestionSuffix } from '@/lib/agentic/suggestion-suffix';

const loadSuggestCache = () => import('@/lib/agentic/suggestion-cache');

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';
type SuggestionSource = 'offline' | 'ai';
export type MomentIntelMode = 'create' | 'reply';

const PREF_KEY = 'f_moment_create_with_agent';

/** empty → proactive; warming → wait for a few kickoff words; ready → normal complete */
function replyKickoffPhase(draft: string): 'empty' | 'warming' | 'ready' {
  const t = String(draft || '').trim();
  if (!t) return 'empty';
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 && t.length < 12) return 'warming';
  return 'ready';
}

export function useMomentIntelligence(opts: {
  userId?: string;
  displayName?: string;
  draft: string;
  enabled: boolean;
  isPro: boolean;
  onOpenPro: () => void;
  setDraft: (next: string) => void;
  /** Reply composers suggest before typing; create stays conservative. */
  mode?: MomentIntelMode;
  parentSnippet?: string;
  parentMomentId?: string;
}) {
  const {
    userId,
    displayName,
    draft,
    enabled,
    isPro,
    onOpenPro,
    setDraft,
    mode = 'create',
    parentSnippet = '',
    parentMomentId = '',
  } = opts;
  const isReply = mode === 'reply';

  const [learningStatus, setLearningStatus] = useState<LearningStatus>('off');
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptStreak, setAcceptStreak] = useState(0);
  const [showWand, setShowWand] = useState(false);

  const applySuggestion = useCallback((raw: string, forDraft: string) => {
    const cleaned = asSuggestionSuffix(forDraft, raw);
    startTransition(() => {
      setSuggestion(cleaned);
    });
    lastShownSuggestionRef.current = cleaned;
    return cleaned;
  }, []);

  const samplesRef = useRef<MomentVoiceSample[]>([]);
  const hintsRef = useRef<string[]>([]);
  const styleNotesRef = useRef<string[]>([]);
  const sessionInfoRef = useRef<string[]>([]);
  const learningsRef = useRef<string[]>([]);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<SuggestionSource>('offline');
  const voiceReadyRef = useRef(false);
  const lastShownSuggestionRef = useRef('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const lastKeystrokeAtRef = useRef(Date.now());
  const pendingAcceptRef = useRef<{
    draftBefore: string;
    suggestion: string;
    draftAfterAccept: string;
  } | null>(null);
  const reinforceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      setLearningStatus('off');
      setSuggestion('');
      voiceReadyRef.current = false;
      return;
    }
    let cancelled = false;
    setLearningStatus('initializing');
    voiceReadyRef.current = false;
    void (async () => {
      try {
        const res = await refreshMomentDoppelgangerVoice(userId);
        if (cancelled) return;
        samplesRef.current = res.samples;
        hintsRef.current = res.hints;
        const { recentLearningsFromSession } = await import('@/lib/agentic/suggest-reinforce-local');
        const learned = recentLearningsFromSession(res.session);
        styleNotesRef.current = learned.styleNotes;
        sessionInfoRef.current = learned.sessionInfo;
        learningsRef.current = learned.learnings;
        voiceReadyRef.current = true;
        setLearningStatus(res.status === 'ready' ? 'ready' : 'empty');
      } catch {
        if (!cancelled) {
          voiceReadyRef.current = true;
          setLearningStatus('empty');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setSuggestion('');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const now = Date.now();
    const typingGap = now - lastKeystrokeAtRef.current;
    lastKeystrokeAtRef.current = now;

    const liveDraft = () => draftRef.current;
    const phase = isReply ? replyKickoffPhase(liveDraft()) : null;
    const trimmed = liveDraft().trimEnd();

    // Create mode: wait until a few characters exist
    if (!isReply) {
      if (trimmed.length < 3) {
        setSuggestion('');
        return;
      }
    } else {
      // Reply warming: user started typing — clear stale empty suggestion and wait
      if (phase === 'warming') {
        setSuggestion('');
      }
      // Wait for voice hydrate before empty proactive (discretion: avoid blank spam)
      if (phase === 'empty' && !voiceReadyRef.current && learningStatus === 'initializing') {
        return;
      }
    }

    // Adaptive debounce — typing bursts must never queue AI/JWT work
    const bursty = typingGap < 140;
    const delayMs = !isReply
      ? bursty
        ? 900
        : 520
      : phase === 'empty'
        ? 600
        : phase === 'warming'
          ? 1100
          : bursty
            ? 950
            : 650;

    debounceRef.current = setTimeout(() => {
      void (async () => {
        // Still typing? bail — next keystroke reschedules
        if (Date.now() - lastKeystrokeAtRef.current < 220) return;

        const draftNow = liveDraft();
        if (isReply) {
          const after = replyKickoffPhase(draftNow);
          if (after === 'warming') return;
        }

        const myReq = ++reqIdRef.current;
        const scope = isReply
          ? `moment_reply_${parentMomentId || 'x'}`
          : 'moment_doppelganger';
        const trimmedNow = draftNow.trimEnd();
        const cacheDraft =
          isReply && !trimmedNow ? `__empty__:${(parentSnippet || '').slice(0, 80)}` : draftNow;

        const { lookupCachedSuggestion, rememberSuggestion } = await loadSuggestCache();
        const cached = await lookupCachedSuggestion({
          scope,
          userId,
          draft: cacheDraft,
        });
        if (myReq !== reqIdRef.current) return;
        if (cached) {
          sourceRef.current = 'offline';
          applySuggestion(cached, draftNow);
          setBusy(false);
          return;
        }

        const offline = isReply
          ? suggestOfflineReply(draftNow, parentSnippet, samplesRef.current)
          : completeOfflineSuffix(draftNow, samplesRef.current, {
              niche: 'connect',
              minConfidence: 0.5,
            });

        const afterPhase = isReply ? replyKickoffPhase(draftNow) : 'ready';
        // Empty reply + parent + Pro: prefer parent-aware AI only after idle
        const idleMs = Date.now() - lastKeystrokeAtRef.current;
        const preferReplyAi =
          isReply &&
          afterPhase === 'empty' &&
          isPro &&
          parentSnippet.trim().length >= 8 &&
          idleMs >= 900;

        const source = preferReplyAi
          ? 'ai'
          : await pickCompletionSource({
              scope,
              offlineSuffix: offline,
              // Never pick AI mid-burst — keeps the input thread free
              allowAi: isPro && idleMs >= 900,
            });

        if (myReq !== reqIdRef.current) return;

        if (source === 'offline') {
          sourceRef.current = 'offline';
          const text = offline.trim();
          applySuggestion(text, draftNow);
          setBusy(false);
          if (text) void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: text });
          return;
        }

        if (source !== 'ai' || !isPro) {
          sourceRef.current = 'offline';
          applySuggestion(offline, draftNow);
          setBusy(false);
          if (offline.trim()) {
            void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: offline.trim() });
          }
          return;
        }

        setBusy(true);
        try {
          await recordAiInference(scope);
          const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
          if (myReq !== reqIdRef.current) return;
          // Abort AI if user typed again while minting JWT
          if (Date.now() - lastKeystrokeAtRef.current < 400) {
            sourceRef.current = 'offline';
            applySuggestion(offline, liveDraft());
            return;
          }
          const { completeMomentDraftAction } = await import('@/lib/actions/moment-doppelganger');
          const res = await completeMomentDraftAction({
            draft: draftNow,
            voiceSamples: samplesRef.current,
            coldStartHints: hintsRef.current,
            displayName,
            jwt,
            replyMode: isReply,
            parentSnippet: isReply ? parentSnippet : undefined,
            styleNotes: styleNotesRef.current,
            sessionInfo: sessionInfoRef.current,
            learnings: learningsRef.current,
          });
          if (myReq !== reqIdRef.current) return;
          if (!res.success) {
            if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
            sourceRef.current = 'offline';
            applySuggestion(offline, liveDraft());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: offline.trim() });
            }
            return;
          }
          const aiText = String(res.completion || '').trim();
          if (aiText) {
            sourceRef.current = 'ai';
            applySuggestion(aiText, liveDraft());
            void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: aiText });
          } else {
            sourceRef.current = 'offline';
            applySuggestion(offline, liveDraft());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: offline.trim() });
            }
          }
        } catch {
          if (myReq === reqIdRef.current) {
            sourceRef.current = 'offline';
            applySuggestion(offline, liveDraft());
          }
        } finally {
          if (myReq === reqIdRef.current) setBusy(false);
        }
      })();
    }, delayMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    draft,
    enabled,
    userId,
    isPro,
    displayName,
    onOpenPro,
    isReply,
    parentSnippet,
    parentMomentId,
    learningStatus,
    applySuggestion,
  ]);

  // Reinforce: after accept, watch subsequent edits; also catch ignored hints
  useEffect(() => {
    if (!userId || !enabled) return;
    if (reinforceTimerRef.current) clearTimeout(reinforceTimerRef.current);

    reinforceTimerRef.current = setTimeout(() => {
      void (async () => {
        const {
          classifySuggestEdit,
          enqueueSuggestReinforce,
        } = await import('@/lib/agentic/suggest-reinforce-local');

        const pending = pendingAcceptRef.current;
        if (pending) {
          const kind = classifySuggestEdit({
            draftBefore: pending.draftBefore,
            suggestion: pending.suggestion,
            draftAfter: draft,
            accepted: true,
          });
          // Settle once draft is stable relative to accept
          if (draft !== pending.draftAfterAccept || kind !== 'accepted_verbatim') {
            await enqueueSuggestReinforce({
              userId,
              signal: {
                kind,
                mode: isReply ? 'reply' : 'create',
                draftBefore: pending.draftBefore,
                suggestion: pending.suggestion,
                draftAfter: draft,
                parentSnippet: isReply ? parentSnippet : undefined,
                at: new Date().toISOString(),
              },
            });
            pendingAcceptRef.current = null;
          } else if (kind === 'accepted_verbatim' && draft === pending.draftAfterAccept) {
            // Still verbatim after settle window — record once
            await enqueueSuggestReinforce({
              userId,
              signal: {
                kind: 'accepted_verbatim',
                mode: isReply ? 'reply' : 'create',
                draftBefore: pending.draftBefore,
                suggestion: pending.suggestion,
                draftAfter: draft,
                parentSnippet: isReply ? parentSnippet : undefined,
                at: new Date().toISOString(),
              },
            });
            pendingAcceptRef.current = null;
          }
          return;
        }

        // Ignored: had a hint, user typed instead without accepting
        const shown = lastShownSuggestionRef.current;
        if (shown && !suggestion && draft.trim().length >= 3) {
          const kind = classifySuggestEdit({
            draftBefore: draft.slice(0, Math.max(0, draft.length - 1)),
            suggestion: shown,
            draftAfter: draft,
            accepted: false,
          });
          if (kind === 'ignored_suggestion' || kind === 'deleted_hint') {
            await enqueueSuggestReinforce({
              userId,
              signal: {
                kind,
                mode: isReply ? 'reply' : 'create',
                draftBefore: '',
                suggestion: shown,
                draftAfter: draft,
                parentSnippet: isReply ? parentSnippet : undefined,
                at: new Date().toISOString(),
              },
            });
            lastShownSuggestionRef.current = '';
          }
        }
      })();
    }, 1600);

    return () => {
      if (reinforceTimerRef.current) clearTimeout(reinforceTimerRef.current);
    };
  }, [draft, suggestion, userId, enabled, isReply, parentSnippet]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    if (sourceRef.current === 'ai' && !isPro) {
      onOpenPro();
      return;
    }
    const joiner =
      draft.length === 0 || /\s$/.test(draft) || suggestion.startsWith(' ') || /^[.,!?;:]/.test(suggestion)
        ? ''
        : ' ';
    const next = `${draft}${joiner}${suggestion}`;
    pendingAcceptRef.current = {
      draftBefore: draft,
      suggestion,
      draftAfterAccept: next,
    };
    lastShownSuggestionRef.current = '';
    setDraft(next);
    setSuggestion('');
    setAcceptStreak((n) => {
      const nextStreak = n + 1;
      if (nextStreak >= 2) setShowWand(true);
      return nextStreak;
    });
  }, [suggestion, draft, setDraft, isPro, onOpenPro]);

  const flushReinforce = useCallback(() => {
    if (!userId) return;
    void import('@/lib/agentic/suggest-reinforce-local').then(({ scheduleReinforceFlush }) => {
      scheduleReinforceFlush(userId, true);
    });
  }, [userId]);

  const runTakeover = useCallback(async () => {
    if (!userId) return;
    if (!isPro) {
      onOpenPro();
      return;
    }
    const scope = isReply ? `moment_reply_takeover_${parentMomentId || 'x'}` : 'moment_takeover';
    setBusy(true);
    try {
      const { lookupCachedTakeover, rememberTakeover } = await loadSuggestCache();
      const cached = await lookupCachedTakeover({ scope, userId, draft });
      if (cached) {
        setDraft(cached);
        setSuggestion('');
        setAcceptStreak(0);
        return;
      }
      await recordAiInference(scope);
      const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
      const { generateMomentTakeoverAction, completeMomentDraftAction } = await import(
        '@/lib/actions/moment-doppelganger'
      );

      if (isReply) {
        // Reply takeover: full parent-aware reply body
        const res = await completeMomentDraftAction({
          draft: '',
          voiceSamples: samplesRef.current,
          coldStartHints: hintsRef.current,
          displayName,
          jwt,
          replyMode: true,
          parentSnippet,
          styleNotes: styleNotesRef.current,
          sessionInfo: sessionInfoRef.current,
          learnings: learningsRef.current,
        });
        if (!res.success || !res.completion) {
          if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
          return;
        }
        setDraft(res.completion);
        setSuggestion('');
        setAcceptStreak(0);
        void rememberTakeover({ scope, userId, draft, body: res.completion });
        return;
      }

      const res = await generateMomentTakeoverAction({
        draft,
        voiceSamples: samplesRef.current,
        coldStartHints: hintsRef.current,
        displayName,
        jwt,
        styleNotes: styleNotesRef.current,
        sessionInfo: sessionInfoRef.current,
        learnings: learningsRef.current,
      });
      if (!res.success || !res.post) {
        if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
        return;
      }
      setDraft(res.post);
      setSuggestion('');
      setAcceptStreak(0);
      void rememberTakeover({ scope, userId, draft, body: res.post });
    } finally {
      setBusy(false);
    }
  }, [userId, isPro, onOpenPro, draft, displayName, setDraft, isReply, parentMomentId, parentSnippet]);

  return {
    learningStatus,
    suggestion,
    busy,
    acceptStreak,
    showWand,
    acceptSuggestion,
    runTakeover,
    flushReinforce,
  };
}

export async function loadMomentAgentPref(): Promise<boolean> {
  const pref = await LocalEngine.cacheGet<boolean>(PREF_KEY);
  if (pref === null || pref === undefined) return true;
  return Boolean(pref);
}

export async function saveMomentAgentPref(next: boolean): Promise<void> {
  await LocalEngine.cacheSet(PREF_KEY, next);
}
