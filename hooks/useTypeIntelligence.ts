'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { refreshTypeIntelVoice } from '@/lib/agentic/type-intel-local';
import type { TypeIntelVoiceSample } from '@/lib/agentic/prompts/type-intel';
import type { TypeIntelKind } from '@/lib/agentic/type-intel-kinds';
import { TYPE_INTEL_KINDS, typeIntelPrefKey } from '@/lib/agentic/type-intel-kinds';

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';

export function useTypeIntelligence(opts: {
  kind: TypeIntelKind;
  userId?: string;
  displayName?: string;
  draft: string;
  enabled: boolean;
  isPro: boolean;
  onOpenPro: () => void;
  setDraft: (next: string) => void;
}) {
  const { kind, userId, displayName, draft, enabled, isPro, onOpenPro, setDraft } = opts;

  const [learningStatus, setLearningStatus] = useState<LearningStatus>('off');
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptStreak, setAcceptStreak] = useState(0);
  const [showWand, setShowWand] = useState(false);

  const samplesRef = useRef<TypeIntelVoiceSample[]>([]);
  const hintsRef = useRef<string[]>([]);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const res = await refreshTypeIntelVoice(kind, userId);
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
  }, [enabled, userId, kind]);

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
          const { completeTypeIntelDraftAction } = await import('@/lib/actions/type-intel');
          const res = await completeTypeIntelDraftAction({
            kind,
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
  }, [draft, enabled, userId, isPro, displayName, onOpenPro, kind]);

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
      const { generateTypeIntelTakeoverAction } = await import('@/lib/actions/type-intel');
      const res = await generateTypeIntelTakeoverAction({
        kind,
        draft,
        voiceSamples: samplesRef.current,
        coldStartHints: hintsRef.current,
        displayName,
        jwt,
      });
      if (!res.success || !res.draft) {
        if (String(res.error || '').toLowerCase().includes('pro')) onOpenPro();
        return;
      }
      setDraft(res.draft);
      setSuggestion('');
      setAcceptStreak(0);
    } finally {
      setBusy(false);
    }
  }, [userId, isPro, onOpenPro, draft, displayName, setDraft, kind]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!suggestion) return;
      if (e.key !== 'ArrowRight' && e.key !== 'Tab') return;
      const target = e.currentTarget;
      const isAtEnd = target.selectionStart === target.value.length;
      if (!isAtEnd) return;
      e.preventDefault();
      acceptSuggestion();
    },
    [suggestion, acceptSuggestion],
  );

  const label = TYPE_INTEL_KINDS[kind].label;
  const learningLabel =
    learningStatus === 'initializing'
      ? 'Setting up smart writing…'
      : learningStatus === 'ready'
        ? `Learning from your ${label}s for smart writing`
        : learningStatus === 'empty'
          ? `Ready — will learn as you create ${label}s`
          : null;

  return {
    learningStatus,
    learningLabel,
    suggestion,
    busy,
    acceptStreak,
    showWand,
    acceptSuggestion,
    runTakeover,
    handleKeyDown,
    accent: TYPE_INTEL_KINDS[kind].accent,
  };
}

export async function loadTypeIntelAgentPref(kind: TypeIntelKind): Promise<boolean> {
  const pref = await LocalEngine.cacheGet<boolean>(typeIntelPrefKey(kind));
  if (pref === null || pref === undefined) return true;
  return Boolean(pref);
}

export async function saveTypeIntelAgentPref(kind: TypeIntelKind, next: boolean): Promise<void> {
  await LocalEngine.cacheSet(typeIntelPrefKey(kind), next);
}

/** Pref + toggle state for create composers. */
export function useTypeIntelEnabled(kind: TypeIntelKind) {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    void loadTypeIntelAgentPref(kind).then(setEnabled);
  }, [kind]);
  const persist = useCallback(
    (next: boolean) => {
      setEnabled(next);
      void saveTypeIntelAgentPref(kind, next);
    },
    [kind],
  );
  return { enabled, persist };
}
