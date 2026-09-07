'use client';

import React from 'react';
import { ArrowRight, Sparkles, Wand2 } from 'lucide-react';

type LearningStatus = 'off' | 'initializing' | 'ready' | 'empty';

type ToggleProps = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  accent?: string;
  learningStatus?: LearningStatus;
  learningLabel?: string | null;
  busy?: boolean;
  className?: string;
  /** Plan lacks this feature — still show control; enable attempt opens upgrade. */
  locked?: boolean;
  onLockedAttempt?: () => void;
};

/** Compact “Kylie assist” switch — lives under the field, not in the typing plane. */
export function TypeIntelToggle({
  enabled,
  onToggle,
  accent = '#F59E0B',
  learningStatus,
  learningLabel,
  busy,
  className = '',
  locked = false,
  onLockedAttempt,
}: ToggleProps) {
  return (
    <div className={`flex flex-col gap-1 shrink-0 ${className}`}>
      <div className="rounded-xl bg-[#000000] border border-white/20 p-2.5 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles
            size={14}
            className="shrink-0"
            style={{ color: enabled ? accent : 'rgba(255,255,255,0.4)' }}
          />
          <p className="text-[11px] font-extrabold text-white truncate">Kylie assist</p>
          {locked && !enabled ? (
            <span className="text-[8px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/25 shrink-0">
              Pro
            </span>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => {
            if (!enabled && locked) {
              onLockedAttempt?.();
              return;
            }
            onToggle(!enabled);
          }}
          className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
          style={{ backgroundColor: enabled ? accent : 'rgba(255,255,255,0.1)' }}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {enabled && learningLabel ? (
        <p className="text-[10px] font-bold text-white flex items-center gap-1.5 px-0.5">
          {learningStatus === 'initializing' ? (
            <span
              className="w-2.5 h-2.5 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: `${accent}66`, borderTopColor: accent }}
            />
          ) : (
            <Sparkles size={11} style={{ color: accent }} />
          )}
          <span>{learningLabel}</span>
          {busy ? <span className="text-white">· writing…</span> : null}
        </p>
      ) : null}
    </div>
  );
}

type GhostProps = {
  /** Typed text so far (spacer — kept invisible so ghost sits where typing ends). */
  draft: string;
  suggestion: string;
  enabled: boolean;
  showWand: boolean;
  busy?: boolean;
  accent?: string;
  onAccept: () => void;
  onTakeover: () => void;
  /**
   * Must match the textarea’s typography + padding exactly
   * (e.g. `p-2 text-base leading-relaxed font-satoshi`).
   */
  className?: string;
};

/**
 * IDE-style ghost complete: muted suffix right after typed text,
 * then accept arrow, then wand (when unlocked).
 * Parent must be `relative`; textarea sits under this layer.
 */
export function TypeIntelGhostLayer({
  draft,
  suggestion,
  enabled,
  showWand,
  busy,
  accent = '#F59E0B',
  onAccept,
  onTakeover,
  className = '',
}: GhostProps) {
  if (!enabled || (!suggestion && !showWand)) return null;

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words ${className}`}
    >
      {/* Invisible spacer mirrors typed text so ghost starts at caret-end */}
      <span className="invisible">{draft}</span>
      {suggestion ? <span className="text-white/28">{suggestion}</span> : null}
      <span className="inline-flex items-center gap-1 ml-1 align-middle pointer-events-auto relative z-20 translate-y-[1px]">
        {suggestion ? (
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="w-6 h-6 rounded-full bg-[#000000] border-2 border-white/20 flex items-center justify-center transition-colors cursor-pointer hover:border-white/45 disabled:opacity-50"
            style={{ color: accent }}
            title="Accept suggestion"
            aria-label="Accept suggestion"
          >
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        ) : null}
        {showWand ? (
          <button
            type="button"
            onClick={onTakeover}
            disabled={busy}
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer text-black disabled:opacity-50"
            style={{ backgroundColor: accent, borderColor: accent }}
            title="Write full draft in your style"
            aria-label="Write full draft in your style"
          >
            <Wand2 size={11} strokeWidth={2.5} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** @deprecated Prefer TypeIntelToggle + TypeIntelGhostLayer */
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
}: {
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
  toggleOnly?: boolean;
  hideToggle?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 shrink-0 ${className}`}>
      {!hideToggle ? (
        <TypeIntelToggle
          enabled={enabled}
          onToggle={onToggle}
          accent={accent}
          learningStatus={toggleOnly ? undefined : learningStatus}
          learningLabel={toggleOnly ? null : learningLabel}
          busy={busy}
        />
      ) : null}
      {!toggleOnly && enabled && (suggestion || showWand) ? (
        <div className="flex items-center gap-1.5 flex-wrap pl-0.5">
          {suggestion ? (
            <>
              <span className="text-[10px] font-mono text-white/35 truncate max-w-[min(100%,220px)]">
                {suggestion}
              </span>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="w-7 h-7 rounded-full bg-[#000000] border-2 border-white/20 flex items-center justify-center"
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
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-black"
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

/** @deprecated use TypeIntelGhostLayer */
export function TypeIntelGhostOverlay(props: {
  draft: string;
  suggestion: string;
  enabled: boolean;
  className?: string;
}) {
  if (!props.enabled || !props.suggestion) return null;
  return (
    <div
      aria-hidden
      className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words ${props.className || ''}`}
    >
      <span className="text-transparent">{props.draft}</span>
      <span className="text-white/28">{props.suggestion}</span>
    </div>
  );
}
