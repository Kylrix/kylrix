'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  const samplesRef = useRef<MomentVoiceSample[]>([]);
  const hintsRef = useRef<string[]>([]);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<SuggestionSource>('offline');
  const voiceReadyRef = useRef(false);

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

    const phase = isReply ? replyKickoffPhase(draft) : null;
    const trimmed = draft.trimEnd();

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

    const delayMs = !isReply
      ? 380
      : phase === 'empty'
        ? 220
        : phase === 'warming'
          ? 900
          : 420;

    debounceRef.current = setTimeout(() => {
      void (async () => {
        // Re-check warming after wait — only fire once kickoff is ready or still empty
        if (isReply) {
          const after = replyKickoffPhase(draft);
          if (after === 'warming') return;
        }

        const myReq = ++reqIdRef.current;
        const scope = isReply
          ? `moment_reply_${parentMomentId || 'x'}`
          : 'moment_doppelganger';
        const cacheDraft = isReply && !trimmed ? `__empty__:${(parentSnippet || '').slice(0, 80)}` : draft;

        const { lookupCachedSuggestion, rememberSuggestion } = await loadSuggestCache();
        const cached = await lookupCachedSuggestion({
          scope,
          userId,
          draft: cacheDraft,
        });
        if (myReq !== reqIdRef.current) return;
        if (cached) {
          sourceRef.current = 'offline';
          setSuggestion(cached);
          setBusy(false);
          return;
        }

        const offline = isReply
          ? suggestOfflineReply(draft, parentSnippet, samplesRef.current)
          : completeOfflineSuffix(draft, samplesRef.current, {
              niche: 'connect',
              minConfidence: 0.5,
            });

        const afterPhase = isReply ? replyKickoffPhase(draft) : 'ready';
        // Empty reply + parent + Pro: prefer parent-aware AI; offline is fallback only
        const preferReplyAi =
          isReply && afterPhase === 'empty' && isPro && parentSnippet.trim().length >= 8;

        const source = preferReplyAi
          ? 'ai'
          : await pickCompletionSource({
              scope,
              offlineSuffix: offline,
              allowAi: isPro,
            });

        if (myReq !== reqIdRef.current) return;

        if (source === 'offline') {
          sourceRef.current = 'offline';
          const text = offline.trim();
          setSuggestion(text);
          setBusy(false);
          if (text) void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: text });
          return;
        }

        if (source !== 'ai' || !isPro) {
          sourceRef.current = 'offline';
          setSuggestion(offline.trim());
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
          const { completeMomentDraftAction } = await import('@/lib/actions/moment-doppelganger');
          const res = await completeMomentDraftAction({
            draft,
            voiceSamples: samplesRef.current,
            coldStartHints: hintsRef.current,
            displayName,
            jwt,
            replyMode: isReply,
            parentSnippet: isReply ? parentSnippet : undefined,
          });
          if (myReq !== reqIdRef.current) return;
          if (!res.success) {
            if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
            sourceRef.current = 'offline';
            setSuggestion(offline.trim());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: offline.trim() });
            }
            return;
          }
          const aiText = String(res.completion || '').trim();
          if (aiText) {
            sourceRef.current = 'ai';
            setSuggestion(aiText);
            void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: aiText });
          } else {
            sourceRef.current = 'offline';
            setSuggestion(offline.trim());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft: cacheDraft, suggestion: offline.trim() });
            }
          }
        } catch {
          if (myReq === reqIdRef.current) {
            sourceRef.current = 'offline';
            setSuggestion(offline.trim());
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
  ]);

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
    setDraft(`${draft}${joiner}${suggestion}`);
    setSuggestion('');
    setAcceptStreak((n) => {
      const next = n + 1;
      if (next >= 2) setShowWand(true);
      return next;
    });
  }, [suggestion, draft, setDraft, isPro, onOpenPro]);

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
