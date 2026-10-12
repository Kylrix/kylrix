'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { predictiveAutocomplete } from './predictive-autocomplete';
import { patternMatcher } from './pattern-matcher';
import { PredictiveSuggestion, ContextualNiche } from './types';

export interface UseContextualAutocompleteOptions {
  niche?: ContextualNiche;
  activeObjectId?: string;
  tags?: string[];
  minConfidence?: number;
  onAccept?: (completedText: string) => void;
}

export function useContextualAutocomplete(
  text: string,
  options: UseContextualAutocompleteOptions = {}
) {
  const [suggestions, setSuggestions] = useState<PredictiveSuggestion[]>([]);
  const [inlineSuffix, setInlineSuffix] = useState<string | undefined>(undefined);
  const [confidence, setConfidence] = useState<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updatePredictions = useCallback(
    (currentText: string) => {
      if (!currentText || currentText.trim().length < 2) {
        setSuggestions([]);
        setInlineSuffix(undefined);
        setConfidence(0);
        return;
      }

      const result = predictiveAutocomplete.predict(currentText, currentText.length, {
        niche: options.niche,
        activeObjectId: options.activeObjectId,
        tags: options.tags,
        minConfidence: options.minConfidence ?? 0.65,
      });

      setInlineSuffix(result.inlineSuffix);
      setSuggestions(result.suggestions);
      setConfidence(result.confidence);
    },
    [options.niche, options.activeObjectId, options.tags, options.minConfidence]
  );

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updatePredictions(text);
    }, 40);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [text, updatePredictions]);

  /**
   * Handle KeyDown to accept inline ghost text on Tab or ArrowRight at end of input.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((e.key === 'Tab' || e.key === 'ArrowRight') && inlineSuffix) {
        const target = e.currentTarget;
        const isAtEnd = target.selectionStart === target.value.length;
        if (isAtEnd) {
          e.preventDefault();
          const newText = text + inlineSuffix;
          predictiveAutocomplete.recordAccepted(newText, options.niche);
          options.onAccept?.(newText);
          setInlineSuffix(undefined);
          setSuggestions([]);
        }
      }
    },
    [inlineSuffix, text, options]
  );

  /**
   * Ingest submitted content when user completes / submits a sentence or note.
   */
  const recordContent = useCallback(
    (completedText: string) => {
      if (!completedText || completedText.trim().length < 3) return;
      patternMatcher.ingestText(completedText, {
        niche: options.niche || 'workspace',
      });
    },
    [options.niche]
  );

  const acceptSuggestion = useCallback(
    (suggestion: PredictiveSuggestion) => {
      const newText = `${text} ${suggestion.text}`.trim();
      predictiveAutocomplete.recordAccepted(newText, options.niche);
      options.onAccept?.(newText);
      setInlineSuffix(undefined);
      setSuggestions([]);
    },
    [text, options]
  );

  const dismiss = useCallback(() => {
    setInlineSuffix(undefined);
    setSuggestions([]);
  }, []);

  return {
    inlineSuffix,
    suggestions,
    confidence,
    handleKeyDown,
    recordContent,
    acceptSuggestion,
    dismiss,
  };
}
