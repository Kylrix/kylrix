import type { SecondaryObjectPayload } from '@/lib/note-object-secondary';

export type NoteObjectPreviewResult = {
  ok: boolean;
  title?: string;
  href?: string | null;
  previewDataUrl?: string | null;
  childKind?: string;
  bucketId?: string;
  fileId?: string;
  mimeType?: string | null;
  visualKind?: string;
};

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: NoteObjectPreviewResult }>();
const inflight = new Map<string, Promise<NoteObjectPreviewResult>>();

export function noteObjectPreviewCacheKey(
  noteId: string,
  payload: Pick<SecondaryObjectPayload, 'childKind' | 'childId'>,
) {
  return `${noteId}:${payload.childKind}:${payload.childId}`;
}

export function readCachedNoteObjectPreview(key: string): NoteObjectPreviewResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function writeCachedNoteObjectPreview(key: string, value: NoteObjectPreviewResult) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export async function fetchNoteObjectPreviewCached(
  key: string,
  loader: () => Promise<NoteObjectPreviewResult>,
): Promise<NoteObjectPreviewResult> {
  const cached = readCachedNoteObjectPreview(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = loader()
    .then((value) => {
      if (value.ok) writeCachedNoteObjectPreview(key, value);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

