'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ObjectKind } from '@/lib/objects/types';
import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';
import type { Event } from '@/types';
import type { ChatCreateMode } from '@/components/objects/CreateChatComposer';

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
const CreateChatComposer = dynamic(
  () => import('@/components/objects/CreateChatComposer').then((m) => m.CreateChatComposer),
  { ssr: false },
);

type HeightMode = 'partial' | 'full';

export type CreateDrawerKind = ObjectKind | 'chat';

type Props = {
  open: boolean;
  kind: CreateDrawerKind;
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
  /** Chat / hangout composer */
  chatInitialMode?: ChatCreateMode;
  chatLegacyThread?: boolean;
};

/**
 * Modular ecosystem create drawer.
 * Mobile: bottom sheet. Desktop (md+): right sidebar. Never bottom sheet on desktop.
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
  chatInitialMode = 'chat',
  chatLegacyThread = false,
}: Props) {
  const formOnlyFull = kind === 'form';
  const [heightMode, setHeightMode] = useState<HeightMode>(
    formOnlyFull ? 'full' : defaultHeight || 'partial',
  );
  const [isExpanded, setIsExpanded] = useState(formOnlyFull || defaultHeight === 'full');
  const [isDesktop, setIsDesktop] = useState(false);
  const composerCloseRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const mode = formOnlyFull ? 'full' : defaultHeight || 'partial';
    setHeightMode(mode);
    setIsExpanded(mode === 'full' || isDesktop);
  }, [open, formOnlyFull, defaultHeight, isDesktop]);

  const requestClose = useCallback(() => {
    if (composerCloseRef.current) {
      composerCloseRef.current();
      return;
    }
    onClose();
  }, [onClose]);

  const toggleExpand = useCallback(() => {
    if (formOnlyFull || isDesktop) return;
    setIsExpanded((v) => {
      const next = !v;
      setHeightMode(next ? 'full' : 'partial');
      return next;
    });
  }, [formOnlyFull, isDesktop]);

  if (!open) return null;

  const maxHeight = isDesktop
    ? '100dvh'
    : heightMode === 'full' || formOnlyFull
      ? '96dvh'
      : '60dvh';

  return (
    <div
      className={`fixed inset-0 z-[1400] flex pointer-events-none ${
        isDesktop ? 'items-stretch justify-end' : 'items-end justify-center'
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55 pointer-events-auto"
        onClick={requestClose}
      />
      <div
        className={
          isDesktop
            ? 'w-full max-w-[480px] h-full pointer-events-auto flex flex-col bg-[#161412] border-l border-[#34322F] overflow-hidden shadow-[-12px_0_36px_rgba(0,0,0,0.5)]'
            : 'w-full max-w-[720px] pointer-events-auto flex flex-col bg-[#161412] border border-[#34322F] border-b-0 rounded-t-[24px] overflow-hidden fixed bottom-0 left-1/2 -translate-x-1/2 shadow-[0_-12px_36px_rgba(0,0,0,0.5)]'
        }
        style={isDesktop ? { height: '100dvh' } : { height: maxHeight, maxHeight }}
      >
        {!isDesktop ? (
          <button
            type="button"
            onClick={toggleExpand}
            disabled={formOnlyFull}
            className="flex justify-center py-1.5 w-full shrink-0 border-b border-[#34322F]"
            aria-label={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
          >
            <span className="w-10 h-1 rounded-full bg-[#3D3A36]" />
          </button>
        ) : null}

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
              isExpanded={isExpanded || isDesktop}
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
              isExpanded={isExpanded || isDesktop}
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
              isExpanded={isExpanded || isDesktop}
              onToggleExpand={toggleExpand}
              onClose={onClose}
            />
          ) : null}

          {kind === 'chat' ? (
            <CreateChatComposer
              onClose={onClose}
              onRegisterClose={(close) => {
                composerCloseRef.current = close;
              }}
              isExpanded={isExpanded || isDesktop}
              onToggleExpand={toggleExpand}
              initialMode={chatInitialMode}
              legacyThread={chatLegacyThread}
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
