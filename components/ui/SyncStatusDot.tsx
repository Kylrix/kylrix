'use client';

import { isUnpersistedComposeDraft } from '@/lib/notes/compose-draft-registry';

/** Amber/green from the same compose draft set CreateNoteForm uses. */
export function SyncStatusDot({
  noteId,
  epoch,
  pending,
}: {
  noteId?: string | null;
  /** Subscribe to composeSyncEpoch so React re-evaluates after register/unregister. */
  epoch?: number;
  /** Optional override (e.g. CreateNoteForm-style local isDirty before effect registers). */
  pending?: boolean;
}) {
  void epoch;
  const isPending =
    typeof pending === 'boolean'
      ? pending
      : Boolean(
          noteId &&
            (noteId.startsWith('live-') ||
              noteId.startsWith('ghost-') ||
              isUnpersistedComposeDraft(noteId)),
        );

  if (isPending) {
    return (
      <span
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
        title="Not saved yet"
      />
    );
  }

  return (
    <span
      className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
      title="Saved"
    />
  );
}
