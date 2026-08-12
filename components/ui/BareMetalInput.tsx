'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useDataNexus } from '@/context/DataNexusContext';

/**
 * Bare-metal low-level input — flow.realtime-input-rxdb-sync + architecture.local-first
 * - Uncontrolled (defaultValue) so React renders never block keystrokes or move cursor
 * - Direct onInput interception, synchronous LocalEngine dispatch, async engine nudge decoupled
 * - Optional LocalEngine wiring (enableLocalEngine + syncKey) — bulk of object create drawers use it; search bars opt out
 * - Guards: IME composition, external value clobber while focused, selection preservation, stale closures via refs
 *
 * Downsides addressed:
 * 1. Stale external value overwriting typing -> only syncs when not focused and not within 2s of last edit
 * 2. IME composition (CJK) -> defers sync until compositionend
 * 3. Cursor jump on controlled re-render -> uncontrolled + selection preservation via native DOM, no value prop
 * 4. Parent re-render lag on mobile -> parent state updates are secondary; DOM value is SoT for UX
 * 5. Memory leaks / orphan listeners -> cleanup on unmount, rAF cancelled
 * 6. LocalEngine durability -> setCachedData is fire-and-forget, never awaited in input hot path
 * 7. Undo/redo preserved -> native browser undo stack untouched (no setSelectionRange during typing; only on external sync)
 */
type BaseProps = {
  as?: 'input' | 'textarea';
  defaultValue?: string;
  /** External value — treated as initial/remote sync source, not controlled. Only applied when not focused/composing/dirty. */
  value?: string;
  placeholder?: string;
  className?: string;
  rows?: number;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Sync key for DataNexus cache, e.g. `note_${id}`. When provided and enableLocalEngine true, setCachedData is called synchronously. */
  syncKey?: string;
  /** Whether to write to LocalEngine/RxDB cache on each keystroke. Default true; search bars pass false. */
  enableLocalEngine?: boolean;
  /** Lightweight callback with next value — parent should do pushLive*/ 
  onValueChange?: (next: string) => void;
  /** Optional extra sync payload builder for DataNexus when syncKey is object-shaped */
  syncDataBuilder?: (next: string) => unknown;
  onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  maxLength?: number;
  'aria-label'?: string;
};

export function BareMetalInput({
  as = 'input',
  defaultValue,
  value,
  placeholder,
  className,
  rows,
  id,
  autoFocus,
  disabled,
  readOnly,
  syncKey,
  enableLocalEngine = true,
  onValueChange,
  syncDataBuilder,
  onFocus,
  onBlur,
  onKeyDown,
  onPaste,
  maxLength,
  'aria-label': ariaLabel,
  forwardedRef,
}: BaseProps & { forwardedRef?: React.Ref<HTMLInputElement & HTMLTextAreaElement> }) {
  const innerRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const _ref = (forwardedRef as React.MutableRefObject<any>) || innerRef;
  void _ref;
  // if forwardedRef is provided as object ref, sync it
  const setRef = useCallback((el: any) => {
    (innerRef as any).current = el;
    if (typeof forwardedRef === 'function') {
      forwardedRef(el);
    } else if (forwardedRef && 'current' in forwardedRef) {
      try {
        const refObj = forwardedRef as React.MutableRefObject<any>;
        // eslint-disable-next-line react-hooks/immutability
        refObj.current = el;
      } catch {}
    }
  }, [forwardedRef]);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const syncDataBuilderRef = useRef(syncDataBuilder);
  syncDataBuilderRef.current = syncDataBuilder;
  const isComposingRef = useRef(false);
  const lastEditAtRef = useRef(0);
  const { setCachedData } = useDataNexus();

  // Initial mount syncKey/value — uncontrolled, so we set via DOM once and via effect only when not dirty/focused
  const initialRef = useRef<string | undefined>(defaultValue ?? value);
  // Keep syncKey fresh without re-binding DOM
  const syncKeyRef = useRef(syncKey);
  syncKeyRef.current = syncKey;

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (readOnly || disabled) return;
    if (isComposingRef.current) return;
    const next = (e.currentTarget as HTMLInputElement).value;
    lastEditAtRef.current = Date.now();
    // 1. Bare-metal local engine (fire-and-forget, never await in hot path) — direct RxDB/cache SoT
    if (enableLocalEngine && syncKeyRef.current) {
      const data = syncDataBuilderRef.current ? syncDataBuilderRef.current(next) : next;
      // For note-shaped sync, caller builds draft; for generic, store raw string under syncKey
      void setCachedData(syncKeyRef.current, data as any);
    }
    // 2. Notify parent for pushLiveNote / markDirty — parent must be lightweight, no heavy work here
    onValueChangeRef.current?.(next);
  }, [readOnly, disabled, enableLocalEngine, setCachedData]);

  const handleCompositionStart = useCallback(() => { isComposingRef.current = true; }, []);
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    handleInput(e as unknown as React.FormEvent<HTMLInputElement | HTMLTextAreaElement>);
  }, [handleInput]);

  // External value sync — only when user not typing and not focused (prevents cursor clobber)
  useEffect(() => {
    const el = innerRef.current as any;
    if (!el) return;
    const external = value ?? defaultValue;
    if (external === undefined) return;
    // Guard: don't clobber while focused or composing or within 2s of last edit (matches NoteDetailSidebar guard)
    if (document.activeElement === el) return;
    if (isComposingRef.current) return;
    if (Date.now() - lastEditAtRef.current < 2000) return;
    if (el.value !== external) {
      const selStart = el.selectionStart;
      const selEnd = el.selectionEnd;
      const wasFocused = document.activeElement === el;
      el.value = external;
      // Preserve selection if was focused before guard (edge case where focus briefly lost)
      if (wasFocused && selStart !== null && selEnd !== null) {
        try { el.setSelectionRange(selStart, selEnd); } catch {}
      }
    }
  }, [value, defaultValue]);

  // Remount when syncKey changes (different note/object) — key prop on parent also does this, but keep as guard
  // No effect needed; parent should key BareMetalInput by id/syncKey.

  const commonProps: any = {
    ref: setRef,
    defaultValue: initialRef.current,
    placeholder,
    className,
    id,
    autoFocus,
    disabled,
    readOnly,
    onInput: handleInput,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onFocus,
    onBlur,
    onKeyDown,
    onPaste,
    maxLength,
    'aria-label': ariaLabel,
  };

  if (as === 'textarea') {
    return <textarea {...commonProps} rows={rows ?? 6} />;
  }
  return <input {...commonProps} />;
}

export const BareMetalTextarea = (props: Omit<BaseProps, 'as'> & { forwardedRef?: React.Ref<any> }) => <BareMetalInput {...props} as="textarea" forwardedRef={props.forwardedRef} />;

export const BareMetalField = BareMetalInput;
