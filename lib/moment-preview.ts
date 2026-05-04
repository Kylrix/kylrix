const STORAGE_KEY = 'kylrix_connect_moment_previews_v1';
const MAX_ENTRIES = 50;

type MomentPreview = {
  $id: string;
  userId?: string | null;
  creatorId?: string | null;
  caption?: string | null;
  createdAt?: string | null;
  $createdAt?: string | null;
  metadata?: any;
  stats?: any;
  isLiked?: boolean;
  isPulsed?: boolean;
  creator?: any;
  sourceMoment?: any;
};

const memoryCache = new Map<string, MomentPreview>();
let hydrated = false;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function hydrate() {
  if (hydrated || !canUseStorage()) return;
  hydrated = true;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, MomentPreview>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (value && value.$id) {
        memoryCache.set(key, value);
      }
    });
  } catch {
    // Ignore corrupted preview cache.
  }
}

function persist() {
  if (!canUseStorage()) return;

  try {
    const entries = Array.from(memoryCache.entries()).slice(-MAX_ENTRIES);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Best-effort only.
  }
}

export function seedMomentPreview(moment: MomentPreview | null | undefined) {
  hydrate();
  if (!moment?.$id) return null;

  const preview: MomentPreview = {
    $id: moment.$id,
    userId: moment.userId ?? null,
    creatorId: moment.creatorId ?? null,
    caption: moment.caption ?? null,
    createdAt: moment.createdAt ?? null,
    $createdAt: moment.$createdAt ?? null,
    metadata: moment.metadata ?? null,
    stats: moment.stats ?? null,
    isLiked: moment.isLiked,
    isPulsed: moment.isPulsed,
    creator: moment.creator ?? null,
    sourceMoment: moment.sourceMoment ?? null,
  };

  memoryCache.set(preview.$id, preview);
  persist();
  return preview;
}

export function getCachedMomentPreview(momentId?: string | null) {
  if (!momentId) return null;
  hydrate();
  return memoryCache.get(momentId) || null;
}

