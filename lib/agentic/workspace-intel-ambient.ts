/**
 * Workspace ambient intelligence — occasional notification tips, not create-drawer ghost text.
 * All object sampling + throttle state is LocalEngine-only. AI is rare and result-cached.
 */

import { pushLocalSystemNotification } from '@/lib/agentic/local-notifications';
import { redactForTypeIntel } from '@/lib/agentic/type-intel-local';

const LAST_NUDGE_KEY = (uid: string) => `f_workspace_intel_last_nudge_${uid}`;
const AI_CACHE_KEY = (uid: string) => `f_workspace_intel_ai_nudge_${uid}`;
const PREF_KEY = 'f_workspace_intel_ambient_enabled';

/** Min quiet time between tips shown to the user. */
export const WORKSPACE_INTEL_NUDGE_MIN_MS = 3 * 60 * 60 * 1000;
/** Min quiet time between paid AI generations (reuse LocalEngine cache otherwise). */
export const WORKSPACE_INTEL_AI_MIN_MS = 24 * 60 * 60 * 1000;

type SampledObject = {
  kind: 'workspace' | 'idea' | 'goal' | 'event' | 'form';
  id?: string;
  title: string;
  blurb?: string;
};

type CachedAiNudge = {
  title: string;
  message: string;
  actionHref: string;
  at: number;
  sampleKey: string;
};

async function loadList(keys: string[]): Promise<any[]> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  for (const key of keys) {
    const hit = await LocalEngine.cacheGet<any[]>(key);
    if (Array.isArray(hit) && hit.length) return hit;
  }
  return [];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  if (!arr.length || n <= 0) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function titleOf(row: any): string {
  return redactForTypeIntel(String(row?.title || row?.name || row?.searchTitle || '').trim());
}

function idOf(row: any): string | undefined {
  const id = String(row?.$id || row?.id || '').trim();
  return id || undefined;
}

/** Pull a few random objects from LocalEngine lists only — never hits Appwrite. */
export async function sampleWorkspaceObjectsFromLocal(userId: string): Promise<SampledObject[]> {
  const [projects, notes, goals, events, forms] = await Promise.all([
    loadList([`f_projects_list_${userId}`, 'f_projects_list']),
    loadList([`f_notes_list_${userId}`, 'f_notes_list']),
    loadList([`f_goals_list_${userId}`, 'f_goals_list']),
    loadList([`f_events_list_${userId}`, 'f_events_list']),
    loadList([`f_forms_list_${userId}`, 'f_forms_list', `f_forms_${userId}`]),
  ]);

  const pool: SampledObject[] = [];
  for (const row of pickRandom(projects, 4)) {
    const title = titleOf(row);
    if (title.length < 2) continue;
    pool.push({
      kind: 'workspace',
      id: idOf(row),
      title,
      blurb: redactForTypeIntel(String(row?.summary || row?.description || '').slice(0, 120)),
    });
  }
  for (const row of pickRandom(notes, 4)) {
    const title = titleOf(row);
    if (title.length < 2) continue;
    pool.push({ kind: 'idea', id: idOf(row), title });
  }
  for (const row of pickRandom(goals, 3)) {
    const title = titleOf(row);
    if (title.length < 2) continue;
    pool.push({ kind: 'goal', id: idOf(row), title });
  }
  for (const row of pickRandom(events, 2)) {
    const title = titleOf(row);
    if (title.length < 2) continue;
    pool.push({ kind: 'event', id: idOf(row), title });
  }
  for (const row of pickRandom(forms, 2)) {
    const title = titleOf(row);
    if (title.length < 2) continue;
    pool.push({ kind: 'form', id: idOf(row), title });
  }

  return pickRandom(pool, 5);
}

function hrefFor(sample: SampledObject): string {
  if (sample.kind === 'workspace' && sample.id) return `/workspace/${sample.id}`;
  if (sample.kind === 'idea' && sample.id) return `/idea/${sample.id}`;
  if (sample.kind === 'goal' && sample.id) return `/goal/${sample.id}`;
  if (sample.kind === 'event' && sample.id) return `/events/${sample.id}`;
  if (sample.kind === 'form' && sample.id) return `/forms/${sample.id}`;
  return '/workspaces';
}

/** Zero-AI tip from sampled local objects. */
export function buildOfflineWorkspaceNudge(samples: SampledObject[]): {
  title: string;
  message: string;
  actionHref: string;
} | null {
  if (!samples.length) return null;
  const primary = samples[0];
  const secondary = samples[1];
  const variants = [
    {
      title: 'Workspace tip',
      message: `Take another look at “${primary.title}” — a short update keeps things clear.`,
      actionHref: hrefFor(primary),
    },
    secondary
      ? {
          title: 'Quiet suggestion',
          message: `“${primary.title}” and “${secondary.title}” might belong together in one workspace.`,
          actionHref: hrefFor(primary.kind === 'workspace' ? primary : secondary),
        }
      : null,
    {
      title: 'Workspace tip',
      message:
        primary.kind === 'workspace'
          ? `Add a one-line summary to “${primary.title}” so future you knows what it is for.`
          : `Park “${primary.title}” under the right workspace when you have a minute.`,
      actionHref: hrefFor(primary),
    },
  ].filter(Boolean) as Array<{ title: string; message: string; actionHref: string }>;

  return variants[Math.floor(Math.random() * variants.length)] || null;
}

export async function isWorkspaceIntelAmbientEnabled(): Promise<boolean> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const pref = await LocalEngine.cacheGet<boolean>(PREF_KEY);
  if (pref === null || pref === undefined) return true;
  return Boolean(pref);
}

export async function setWorkspaceIntelAmbientEnabled(next: boolean): Promise<void> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  await LocalEngine.cacheSet(PREF_KEY, next);
}

/**
 * Occasional workspace tip → LocalEngine notification (+ optional soft toast via caller).
 * Never lists remote tables. AI only if Pro + cache stale; otherwise offline templates.
 */
export async function maybeEmitWorkspaceIntelNudge(opts: {
  userId: string;
  displayName?: string;
  isPro: boolean;
  force?: boolean;
}): Promise<{ emitted: boolean; notificationId?: string; title?: string; message?: string }> {
  const { userId, displayName, isPro, force } = opts;
  if (!userId || userId === 'guest') return { emitted: false };

  if (!(await isWorkspaceIntelAmbientEnabled())) return { emitted: false };

  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const now = Date.now();
  const lastAt = Number((await LocalEngine.cacheGet<number>(LAST_NUDGE_KEY(userId))) || 0);
  if (!force && lastAt && now - lastAt < WORKSPACE_INTEL_NUDGE_MIN_MS) {
    return { emitted: false };
  }

  const samples = await sampleWorkspaceObjectsFromLocal(userId);
  if (!samples.length) return { emitted: false };

  // Keep type-intel project session fed from local samples (LocalEngine + rare remote ensure FF)
  try {
    const { refreshTypeIntelVoice } = await import('@/lib/agentic/type-intel-local');
    void refreshTypeIntelVoice('project', userId);
  } catch {}

  const sampleKey = samples
    .map((s) => `${s.kind}:${s.id || s.title}`)
    .sort()
    .join('|')
    .slice(0, 200);

  let nudge = buildOfflineWorkspaceNudge(samples);
  const aiCache = await LocalEngine.cacheGet<CachedAiNudge>(AI_CACHE_KEY(userId));

  if (aiCache?.message && now - aiCache.at < WORKSPACE_INTEL_AI_MIN_MS) {
    nudge = {
      title: aiCache.title,
      message: aiCache.message,
      actionHref: aiCache.actionHref || nudge?.actionHref || '/workspaces',
    };
  } else if (isPro && navigator.onLine) {
    try {
      const { shouldAllowAiInference, recordAiInference } = await import(
        '@/lib/agentic/offline-complete'
      );
      if (await shouldAllowAiInference('workspace_ambient')) {
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
        if (jwt) {
          await recordAiInference('workspace_ambient');
          const { generateWorkspaceIntelNudgeAction } = await import('@/lib/actions/type-intel');
          const res = await generateWorkspaceIntelNudgeAction({
            jwt,
            displayName,
            samples: samples.map((s) => ({
              kind: s.kind,
              title: s.title,
              blurb: s.blurb,
            })),
          });
          if (res.success && res.title && res.message) {
            nudge = {
              title: res.title,
              message: res.message,
              actionHref: res.actionHref || nudge?.actionHref || '/workspaces',
            };
            await LocalEngine.cacheSet(AI_CACHE_KEY(userId), {
              ...nudge,
              at: now,
              sampleKey,
            } satisfies CachedAiNudge);
          }
        }
      }
    } catch {
      // stay on offline nudge
    }
  }

  if (!nudge) return { emitted: false };

  const notif = await pushLocalSystemNotification(userId, {
    id: `ws_intel_${userId.slice(0, 8)}_${now.toString(36)}`,
    title: nudge.title,
    message: nudge.message,
    accent: '#6366F1',
    actionHref: nudge.actionHref,
    timestamp: now,
  });

  await LocalEngine.cacheSet(LAST_NUDGE_KEY(userId), now);
  return {
    emitted: true,
    notificationId: notif.id,
    title: notif.title,
    message: notif.message,
  };
}
