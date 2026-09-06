'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { account } from '@/lib/appwrite/client';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { refreshTypeIntelVoice } from '@/lib/agentic/type-intel-local';
import type { TypeIntelVoiceSample } from '@/lib/agentic/prompts/type-intel';
import type { TypeIntelKind } from '@/lib/agentic/type-intel-kinds';
import { TYPE_INTEL_KINDS, typeIntelPrefKey } from '@/lib/agentic/type-intel-kinds';
import {
  completeOfflineSuffix,
  pickCompletionSource,
  recordAiInference,
} from '@/lib/agentic/offline-complete';

const loadSuggestCache = () => import('@/lib/agentic/suggestion-cache');

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';
type SuggestionSource = 'offline' | 'ai';

const NICHE_BY_KIND: Record<TypeIntelKind, 'productivity' | 'connect' | 'workspace'> = {
  note: 'productivity',
  goal: 'productivity',
  event: 'connect',
  form: 'productivity',
  project: 'workspace',
};

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
        const myReq = ++reqIdRef.current;
        const scope = `type_intel_${kind}`;

        const { lookupCachedSuggestion, rememberSuggestion } = await loadSuggestCache();
        // Local cache first — absorb delete/retype without AI or offline recompute
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
          niche: NICHE_BY_KIND[kind],
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
  }, [draft, enabled, userId, isPro, displayName, onOpenPro, kind]);

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
    const scope = `type_intel_takeover_${kind}`;
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
      const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
      const { generateTypeIntelTakeoverAction } = await import('@/lib/actions/type-intel');
      await recordAiInference(scope);
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
      void rememberTakeover({ scope, userId, draft, body: res.draft });
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
      ? 'Kylie is getting ready…'
      : learningStatus === 'ready'
        ? `Kylie is learning from your ${label}s`
        : learningStatus === 'empty'
          ? `Kylie assist ready — will learn as you create ${label}s`
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
