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
} from '@/lib/agentic/offline-complete';

const loadSuggestCache = () => import('@/lib/agentic/suggestion-cache');

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';
type SuggestionSource = 'offline' | 'ai';

const PREF_KEY = 'f_moment_create_with_agent';

export function useMomentIntelligence(opts: {
  userId?: string;
  displayName?: string;
  draft: string;
  enabled: boolean;
  isPro: boolean;
  onOpenPro: () => void;
  setDraft: (next: string) => void;
}) {
  const { userId, displayName, draft, enabled, isPro, onOpenPro, setDraft } = opts;

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

  useEffect(() => {
    if (!enabled || !userId) {
      setLearningStatus('off');
      setSuggestion('');
      return;
    }
    let cancelled = false;
    setLearningStatus('initializing');
    void (async () => {
      try {
        const res = await refreshMomentDoppelgangerVoice(userId);
        if (cancelled) return;
        samplesRef.current = res.samples;
        hintsRef.current = res.hints;
        setLearningStatus(res.status === 'ready' ? 'ready' : 'empty');
      } catch {
        if (!cancelled) setLearningStatus('empty');
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

    const trimmed = draft.trimEnd();
    if (trimmed.length < 3) {
      setSuggestion('');
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const myReq = ++reqIdRef.current;
        const scope = 'moment_doppelganger';

        const { lookupCachedSuggestion, rememberSuggestion } = await loadSuggestCache();
        const cached = await lookupCachedSuggestion({
          scope,
          userId,
          draft,
        });
        if (myReq !== reqIdRef.current) return;
        if (cached) {
          sourceRef.current = 'offline';
          setSuggestion(cached);
          setBusy(false);
          return;
        }

        const offline = completeOfflineSuffix(draft, samplesRef.current, {
          niche: 'connect',
          minConfidence: 0.5,
        });
        const source = await pickCompletionSource({
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
          if (text) void rememberSuggestion({ scope, userId, draft, suggestion: text });
          return;
        }

        if (source !== 'ai') {
          setSuggestion('');
          setBusy(false);
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
          });
          if (myReq !== reqIdRef.current) return;
          if (!res.success) {
            if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
            sourceRef.current = 'offline';
            setSuggestion(offline.trim());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft, suggestion: offline.trim() });
            }
            return;
          }
          const aiText = String(res.completion || '').trim();
          if (aiText) {
            sourceRef.current = 'ai';
            setSuggestion(aiText);
            void rememberSuggestion({ scope, userId, draft, suggestion: aiText });
          } else {
            sourceRef.current = 'offline';
            setSuggestion(offline.trim());
            if (offline.trim()) {
              void rememberSuggestion({ scope, userId, draft, suggestion: offline.trim() });
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
    }, 380);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, enabled, userId, isPro, displayName, onOpenPro]);

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
    const scope = 'moment_takeover';
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
      const { generateMomentTakeoverAction } = await import('@/lib/actions/moment-doppelganger');
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
  }, [userId, isPro, onOpenPro, draft, displayName, setDraft]);

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
