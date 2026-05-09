const STORAGE_KEY = 'kylrix_connect_moment_previews_v1';
const MAX_ENTRIES = 50;
const MAX_PERSIST_CAPTION = 12_000;
const MAX_PERSIST_NOTE_CONTENT = 8_000;

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
  /** Hydrated from feed / enrich — keeps Connect post detail off cold note rows when navigating from feed */
  attachedNote?: any;
  attachedEvent?: any;
  attachedCall?: any;
};

const memoryCache = new Map<string, MomentPreview>();
let hydrated = false;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function clampStr(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value);
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function slimNoteForStorage(note: any): any {
  if (!note || typeof note !== 'object') return note;
  const tags = Array.isArray(note.tags) ? note.tags.slice(0, 24) : note.tags;
  return {
    $id: note.$id,
    title: note.title,
    userId: note.userId,
    isPublic: note.isPublic,
    updatedAt: note.updatedAt,
    $updatedAt: note.$updatedAt,
    content: clampStr(note.content, MAX_PERSIST_NOTE_CONTENT),
    tags,
  };
}

function slimEventForStorage(ev: any): any {
  if (!ev || typeof ev !== 'object') return ev;
  return {
    $id: ev.$id,
    title: ev.title,
    description: clampStr(ev.description, 4000),
    startTime: ev.startTime,
    endTime: ev.endTime,
    userId: ev.userId,
  };
}

function slimCallForStorage(call: any): any {
  if (!call || typeof call !== 'object') return call;
  return {
    $id: call.$id,
    title: call.title,
    status: call.status,
    createdAt: call.createdAt,
    userId: call.userId,
  };
}

function slimCreatorForStorage(c: any): any {
  if (!c || typeof c !== 'object') return c;
  return {
    $id: c.$id,
    userId: c.userId,
    username: c.username,
    displayName: c.displayName,
    avatar: c.avatar,
    publicKey: c.publicKey,
  };
}

/** Single-level slim for quoted / threaded source moments (avoid huge persist payloads). */
function slimSourceMomentForStorage(sm: any): any {
  if (!sm || typeof sm !== 'object' || !sm.$id) return sm;
  return {
    $id: sm.$id,
    userId: sm.userId,
    creatorId: sm.creatorId,
    caption: clampStr(sm.caption, MAX_PERSIST_CAPTION),
    createdAt: sm.createdAt,
    $createdAt: sm.$createdAt,
    metadata: sm.metadata,
    stats: sm.stats,
    isLiked: sm.isLiked,
    isPulsed: sm.isPulsed,
    creator: slimCreatorForStorage(sm.creator),
    attachedNote: sm.attachedNote ? slimNoteForStorage(sm.attachedNote) : undefined,
    attachedEvent: sm.attachedEvent ? slimEventForStorage(sm.attachedEvent) : undefined,
    attachedCall: sm.attachedCall ? slimCallForStorage(sm.attachedCall) : undefined,
  };
}

function forSessionStorage(p: MomentPreview): MomentPreview {
  return {
    ...p,
    caption: clampStr(p.caption, MAX_PERSIST_CAPTION),
    creator: slimCreatorForStorage(p.creator),
    sourceMoment: p.sourceMoment ? slimSourceMomentForStorage(p.sourceMoment) : undefined,
    attachedNote: p.attachedNote ? slimNoteForStorage(p.attachedNote) : undefined,
    attachedEvent: p.attachedEvent ? slimEventForStorage(p.attachedEvent) : undefined,
    attachedCall: p.attachedCall ? slimCallForStorage(p.attachedCall) : undefined,
  };
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
    const slimmed = entries.map(([k, v]) => [k, forSessionStorage(v)] as const);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(slimmed)));
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
    attachedNote: moment.attachedNote ?? undefined,
    attachedEvent: moment.attachedEvent ?? undefined,
    attachedCall: moment.attachedCall ?? undefined,
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
