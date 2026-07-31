'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ObjectKind } from '@/lib/objects/types';
import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';
import type { Event } from '@/types';

const CreateNoteForm = dynamic(
  () => import('@/app/(app)/app/(app)/notes/CreateNoteForm'),
  { ssr: false },
);
const CreateGoalComposer = dynamic(
  () => import('@/components/objects/CreateGoalComposer').then((m) => m.CreateGoalComposer),
  { ssr: false },
);
const CreateEventComposer = dynamic(
  () => import('@/components/objects/CreateEventComposer').then((m) => m.CreateEventComposer),
  { ssr: false },
);

type HeightMode = 'partial' | 'full';

type Props = {
  open: boolean;
  kind: ObjectKind;
  onClose: () => void;
  /** Forms are full-only; others start at 60dvh and can expand. */
  defaultHeight?: HeightMode;
  initialContent?: {
    title?: string;
    content?: string;
    isPublic?: boolean;
    isGuest?: boolean;
  };
  onNoteCreated?: (note: Notes) => void;
  onGoalCreated?: (task: Task) => void;
  onEventCreated?: (event: Event) => void;
  onLiveEvent?: (event: Event & { visibility?: string; autoCreateCall?: boolean }) => void;
  onCommitEvent?: (event: Event & { visibility?: string; autoCreateCall?: boolean }) => void | Promise<void>;
  /** @deprecated Prefer live composers; kept for transitional call sites. */
  onSubmit?: (draft: { kind: ObjectKind; title: string; body: string }) => void | Promise<void>;
  submitLabel?: string;
};

/**
 * Modular ecosystem create drawer.
 * Shell owns height (60dvh ↔ full). Composers own live-copy writes, Check close,
 * Enter-to-save in minimized mode, and SyncStatusDot.
 */
export function ObjectCreateDrawer({
  open,
  kind,
  onClose,
  defaultHeight,
  initialContent,
  onNoteCreated,
  onGoalCreated,
  onEventCreated,
  onLiveEvent,
  onCommitEvent,
}: Props) {
  const formOnlyFull = kind === 'form';
  const [heightMode, setHeightMode] = useState<HeightMode>(
    formOnlyFull ? 'full' : defaultHeight || 'partial',
  );
  const [isExpanded, setIsExpanded] = useState(formOnlyFull || defaultHeight === 'full');
  const composerCloseRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const mode = formOnlyFull ? 'full' : defaultHeight || 'partial';
    setHeightMode(mode);
    setIsExpanded(mode === 'full');
  }, [open, formOnlyFull, defaultHeight]);

  const requestClose = useCallback(() => {
    if (composerCloseRef.current) {
      composerCloseRef.current();
      return;
    }
    onClose();
  }, [onClose]);

  const toggleExpand = useCallback(() => {
    if (formOnlyFull) return;
    setIsExpanded((v) => {
      const next = !v;
      setHeightMode(next ? 'full' : 'partial');
      return next;
    });
  }, [formOnlyFull]);

  if (!open) return null;

  const maxHeight = heightMode === 'full' || formOnlyFull ? '96dvh' : '60dvh';

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center pointer-events-none">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55 pointer-events-auto"
        onClick={requestClose}
      />
      <div
        className="w-full max-w-[720px] pointer-events-auto flex flex-col bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[24px] overflow-hidden fixed bottom-0 left-1/2 -translate-x-1/2 shadow-[0_-12px_36px_rgba(0,0,0,0.5)]"
        style={{ height: maxHeight, maxHeight }}
      >
        <button
          type="button"
          onClick={toggleExpand}
          disabled={formOnlyFull}
          className="flex justify-center py-1.5 w-full shrink-0 border-b border-[#34322F]"
          aria-label={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
        >
          <span className="w-10 h-1 rounded-full bg-[#3D3A36]" />
        </button>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {kind === 'note' ? (
            <CreateNoteForm
              initialContent={initialContent}
              onNoteCreated={(note) => {
                onNoteCreated?.(note);
              }}
              onRegisterClose={(close) => {
                composerCloseRef.current = close;
              }}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpand}
              onClose={onClose}
            />
          ) : null}

          {kind === 'goal' ? (
            <CreateGoalComposer
              onGoalCreated={onGoalCreated}
              onRegisterClose={(close) => {
                composerCloseRef.current = close;
              }}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpand}
              onClose={onClose}
            />
          ) : null}

          {kind === 'event' ? (
            <CreateEventComposer
              onEventCreated={onEventCreated}
              onLiveEvent={onLiveEvent}
              onCommitEvent={onCommitEvent}
              onRegisterClose={(close) => {
                composerCloseRef.current = close;
              }}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpand}
              onClose={onClose}
            />
          ) : null}

          {kind === 'form' ? (
            <div className="p-4 text-sm text-white/50 font-satoshi">
              Forms use the full-height builder. Open create form from Forms.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
