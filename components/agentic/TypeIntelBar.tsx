'use client';

import React from 'react';
import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';

type Props = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  accent?: string;
  learningStatus: LearningStatus;
  learningLabel: string | null;
  suggestion: string;
  busy: boolean;
  showWand: boolean;
  onAccept: () => void;
  onTakeover: () => void;
  /** When true, renders only the compact toggle (actions live elsewhere). */
  toggleOnly?: boolean;
  /** Hide toggle when parent already has one. */
  hideToggle?: boolean;
  className?: string;
};

/**
 * Compact OpenBricks type-intel chrome: Create with agent toggle + status + accept/wand.
 */
export function TypeIntelBar({
  enabled,
  onToggle,
  accent = '#F59E0B',
  learningStatus,
  learningLabel,
  suggestion,
  busy,
  showWand,
  onAccept,
  onTakeover,
  toggleOnly = false,
  hideToggle = false,
  className = '',
}: Props) {
  return (
    <div className={`flex flex-col gap-1.5 shrink-0 ${className}`}>
      {!hideToggle ? (
        <div className="rounded-xl bg-[#000000] border border-white/20 p-2.5 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles
              size={14}
              className="shrink-0"
              style={{ color: enabled ? accent : 'rgba(255,255,255,0.4)' }}
            />
            <p className="text-[11px] font-extrabold text-white truncate">Create with agent</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onToggle(!enabled)}
            className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors"
            style={{ backgroundColor: enabled ? accent : 'rgba(255,255,255,0.1)' }}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      ) : null}

      {!toggleOnly && enabled && learningLabel ? (
        <p className="text-[10px] font-bold text-white/40 flex items-center gap-1.5">
          {learningStatus === 'initializing' ? (
            <span
              className="w-2.5 h-2.5 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: `${accent}66`, borderTopColor: accent }}
            />
          ) : (
            <Sparkles size={11} style={{ color: `${accent}b3` }} />
          )}
          <span>{learningLabel}</span>
          {busy ? <span className="text-white/25">· writing…</span> : null}
        </p>
      ) : null}

      {!toggleOnly && enabled && (suggestion || showWand) ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {suggestion ? (
            <>
              <span className="text-[10px] font-mono text-white/35 truncate max-w-[min(100%,220px)]">
                {suggestion}
              </span>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="w-7 h-7 rounded-full bg-[#000000] border-2 border-white/20 flex items-center justify-center transition-colors cursor-pointer hover:border-white/40"
                style={{ color: accent }}
                title="Accept suggestion"
                aria-label="Accept suggestion"
              >
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </>
          ) : null}
          {showWand ? (
            <button
              type="button"
              onClick={onTakeover}
              disabled={busy}
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer text-black"
              style={{ backgroundColor: accent, borderColor: accent }}
              title="Write full draft in your style"
              aria-label="Write full draft in your style"
            >
              <Wand2 size={13} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Ghost suffix overlay for native textarea create surfaces. */
export function TypeIntelGhostOverlay({
  draft,
  suggestion,
  enabled,
  className = '',
}: {
  draft: string;
  suggestion: string;
  enabled: boolean;
  className?: string;
}) {
  if (!enabled || !suggestion) return null;
  return (
    <div
      aria-hidden
      className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words ${className}`}
    >
      <span className="text-transparent">{draft}</span>
      <span className="text-white/28">{suggestion}</span>
    </div>
  );
}
