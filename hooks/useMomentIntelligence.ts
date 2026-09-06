'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  refreshMomentDoppelgangerVoice,
} from '@/lib/agentic/moment-doppelganger-local';
import type { MomentVoiceSample } from '@/lib/agentic/prompts/moment-doppelganger';

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';

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

  // Boot / refresh voice twin when enabled
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

  // Live complete while typing
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
        if (!isPro) return;
        const myReq = ++reqIdRef.current;
        setBusy(true);
        try {
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
            setSuggestion('');
            return;
          }
          setSuggestion(String(res.completion || '').trim());
        } catch {
          if (myReq === reqIdRef.current) setSuggestion('');
        } finally {
          if (myReq === reqIdRef.current) setBusy(false);
        }
      })();
    }, 420);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, enabled, userId, isPro, displayName, onOpenPro]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    if (!isPro) {
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
    setBusy(true);
    try {
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
  if (pref === null || pref === undefined) return true; // enabled by default
  return Boolean(pref);
}

export async function saveMomentAgentPref(next: boolean): Promise<void> {
  await LocalEngine.cacheSet(PREF_KEY, next);
}
