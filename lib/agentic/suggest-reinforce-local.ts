/**
 * Client reinforce loop for Moments assist.
 * Classifies accept/edit/ignore signals, queues them, applies cheap offline learning,
 * and occasionally asks the curator AI what to persist into the doppelganger session.
 */

import {
  AgenticSessionLocalStore,
  momentDoppelgangerSessionId,
} from '@/lib/agentic/session-local-store';
import type { SuggestEditKind, SuggestReinforceSignal } from '@/lib/agentic/prompts/suggest-reinforce';
import { redactForMomentDoppelganger } from '@/lib/agentic/moment-doppelganger-local';

const QUEUE_KEY = (userId: string) => `f_moment_reinforce_q_${userId}`;
const LAST_AI_KEY = (userId: string) => `f_moment_reinforce_ai_${userId}`;
const STYLE_PREFIX = 'MOMENT_STYLE_NOTES_V1:';
const VOICE_PREFIX = 'MOMENT_VOICE_SAMPLES_V1:';
const SESSION_INFO_PREFIX = 'MOMENT_SESSION_INFO_V1:';

const AI_GAP_MS = 90_000;
const FLUSH_IDLE_MS = 7_000;
const MAX_QUEUE = 24;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(
    String(a || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
  const tb = String(b || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return hit / Math.max(tb.length, 1);
}

/** Classify how the user treated a suggestion relative to the final draft. */
export function classifySuggestEdit(opts: {
  draftBefore: string;
  suggestion: string;
  draftAfter: string;
  accepted: boolean;
}): SuggestEditKind {
  const before = String(opts.draftBefore || '');
  const sug = String(opts.suggestion || '').trim();
  const after = String(opts.draftAfter || '');
  const afterTrim = after.trim();

  if (!opts.accepted) {
    if (!sug) return 'ignored_suggestion';
    // They typed something else while a hint was visible
    if (afterTrim && !after.includes(sug.slice(0, Math.min(12, sug.length)))) {
      return 'ignored_suggestion';
    }
    return 'deleted_hint';
  }

  const expected = `${before}${before && !/\s$/.test(before) && sug && !/^\s/.test(sug) ? ' ' : ''}${sug}`.replace(
    /\s+/g,
    ' ',
  );
  const afterNorm = after.replace(/\s+/g, ' ').trim();
  const expectedNorm = expected.replace(/\s+/g, ' ').trim();

  if (afterNorm === expectedNorm || afterNorm === `${before}${sug}`.replace(/\s+/g, ' ').trim()) {
    return 'accepted_verbatim';
  }
  if (afterNorm.startsWith(expectedNorm) || afterNorm.startsWith(`${before}${sug}`.trim())) {
    return 'accepted_then_extended';
  }
  if (expectedNorm.startsWith(afterNorm) && afterNorm.length >= Math.min(12, expectedNorm.length * 0.5)) {
    return 'accepted_then_trimmed';
  }
  const overlap = tokenOverlapRatio(sug, afterNorm.slice(before.length));
  if (overlap < 0.45) return 'accepted_then_rewrote';
  if (afterNorm.length < expectedNorm.length * 0.85) return 'accepted_then_trimmed';
  return 'accepted_then_extended';
}

export function parseStyleNotesFromContext(context?: string): string[] {
  const raw = String(context || '');
  const idx = raw.indexOf(STYLE_PREFIX);
  if (idx < 0) return [];
  try {
    const slice = raw.slice(idx + STYLE_PREFIX.length);
    const end = slice.search(/\nMOMENT_/);
    const json = end >= 0 ? slice.slice(0, end) : slice;
    const parsed = JSON.parse(json.trim());
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function parseSessionInfoFromContext(context?: string): string[] {
  const raw = String(context || '');
  const idx = raw.indexOf(SESSION_INFO_PREFIX);
  if (idx < 0) return [];
  try {
    const slice = raw.slice(idx + SESSION_INFO_PREFIX.length);
    const end = slice.search(/\nMOMENT_/);
    const json = end >= 0 ? slice.slice(0, end) : slice;
    const parsed = JSON.parse(json.trim());
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function rebuildContext(opts: {
  voiceJson: string;
  styleNotes: string[];
  sessionInfo: string[];
}): string {
  const parts = [`${VOICE_PREFIX}${opts.voiceJson || '[]'}`];
  if (opts.styleNotes.length) parts.push(`${STYLE_PREFIX}${JSON.stringify(opts.styleNotes.slice(0, 12))}`);
  if (opts.sessionInfo.length) parts.push(`${SESSION_INFO_PREFIX}${JSON.stringify(opts.sessionInfo.slice(0, 6))}`);
  return parts.join('\n');
}

function extractVoiceJson(context?: string): string {
  const raw = String(context || '');
  if (!raw.startsWith(VOICE_PREFIX)) return '[]';
  const rest = raw.slice(VOICE_PREFIX.length);
  const end = rest.search(/\nMOMENT_/);
  return (end >= 0 ? rest.slice(0, end) : rest).trim() || '[]';
}

async function readQueue(userId: string): Promise<SuggestReinforceSignal[]> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const q = await LocalEngine.cacheGet<SuggestReinforceSignal[]>(QUEUE_KEY(userId));
  return Array.isArray(q) ? q : [];
}

async function writeQueue(userId: string, rows: SuggestReinforceSignal[]): Promise<void> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  await LocalEngine.cacheSet(QUEUE_KEY(userId), rows.slice(-MAX_QUEUE));
}

/** Cheap offline learning — no network. */
async function applyOfflineLearning(signal: SuggestReinforceSignal): Promise<void> {
  try {
    const { predictiveAutocomplete } = await import('@/lib/contextual-engine/predictive-autocomplete');
    const text = redactForMomentDoppelganger(signal.draftAfter || `${signal.draftBefore}${signal.suggestion}`);
    if (text.length >= 12) {
      predictiveAutocomplete.recordAccepted(text, 'connect');
    }
  } catch {}
}

function isInteresting(kind: SuggestEditKind): boolean {
  return (
    kind === 'accepted_then_rewrote' ||
    kind === 'accepted_then_trimmed' ||
    kind === 'ignored_suggestion' ||
    kind === 'accepted_then_extended'
  );
}

export async function enqueueSuggestReinforce(opts: {
  userId: string;
  signal: SuggestReinforceSignal;
}): Promise<void> {
  const userId = String(opts.userId || '').trim();
  if (!userId) return;
  const signal = {
    ...opts.signal,
    draftBefore: redactForMomentDoppelganger(opts.signal.draftBefore).slice(0, 400),
    suggestion: redactForMomentDoppelganger(opts.signal.suggestion).slice(0, 280),
    draftAfter: redactForMomentDoppelganger(opts.signal.draftAfter).slice(0, 500),
    parentSnippet: opts.signal.parentSnippet
      ? redactForMomentDoppelganger(opts.signal.parentSnippet).slice(0, 200)
      : undefined,
    at: opts.signal.at || nowIso(),
  };

  if (
    signal.kind === 'accepted_verbatim' ||
    signal.kind === 'accepted_then_extended' ||
    signal.kind === 'accepted_then_trimmed'
  ) {
    void applyOfflineLearning(signal);
  }

  const q = await readQueue(userId);
  q.push(signal);
  await writeQueue(userId, q);
  scheduleReinforceFlush(userId);
}

export function scheduleReinforceFlush(userId: string, immediate = false): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushSuggestReinforce(userId).catch(() => {});
  }, immediate ? 40 : FLUSH_IDLE_MS);
}

/**
 * Background flush: apply selective AI curation into doppelganger session memory.
 */
export async function flushSuggestReinforce(userId: string): Promise<void> {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const q = await readQueue(uid);
  if (!q.length) return;

  const interesting = q.filter((s) => isInteresting(s.kind));
  const verbatim = q.filter((s) => s.kind === 'accepted_verbatim');

  // Always clear queue after handling — avoid infinite reprocess
  await writeQueue(uid, []);

  // Verbatim accepts: optionally seed a short voice sample locally (no AI)
  if (verbatim.length) {
    try {
      const session = await AgenticSessionLocalStore.getSession(momentDoppelgangerSessionId(uid));
      if (session) {
        let samples: Array<{ text: string; at?: string }> = [];
        try {
          samples = JSON.parse(extractVoiceJson(session.context));
          if (!Array.isArray(samples)) samples = [];
        } catch {
          samples = [];
        }
        for (const v of verbatim.slice(-3)) {
          const phrase = redactForMomentDoppelganger(v.draftAfter).slice(0, 140);
          if (phrase.length < 16) continue;
          if (samples.some((s) => String(s.text || '').slice(0, 40) === phrase.slice(0, 40))) continue;
          samples.unshift({ text: phrase, at: v.at });
        }
        samples = samples.slice(0, 32);
        const styleNotes = parseStyleNotesFromContext(session.context);
        const sessionInfo = parseSessionInfoFromContext(session.context);
        await AgenticSessionLocalStore.upsertSession({
          ...session,
          context: rebuildContext({
            voiceJson: JSON.stringify(samples),
            styleNotes,
            sessionInfo,
          }),
        });
      }
    } catch {}
  }

  if (!interesting.length) return;

  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const lastAi = Number((await LocalEngine.cacheGet<number>(LAST_AI_KEY(uid))) || 0);
  if (lastAi && Date.now() - lastAi < AI_GAP_MS) {
    // Re-queue interesting for later
    const leftover = await readQueue(uid);
    await writeQueue(uid, [...leftover, ...interesting].slice(-MAX_QUEUE));
    return;
  }

  try {
    const { account } = await import('@/lib/appwrite/client');
    const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
    if (!jwt) return;

    const session = await AgenticSessionLocalStore.getSession(momentDoppelgangerSessionId(uid));
    const existingStyle = parseStyleNotesFromContext(session?.context);

    const { reinforceSuggestLearningAction } = await import('@/lib/actions/suggest-reinforce');
    const res = await reinforceSuggestLearningAction({
      jwt,
      signals: interesting.slice(-6),
      existingStyleNotes: existingStyle,
    });
    await LocalEngine.cacheSet(LAST_AI_KEY(uid), Date.now());
    if (!res.success || !res.worthRecording) return;

    const fresh =
      (await AgenticSessionLocalStore.getSession(momentDoppelgangerSessionId(uid))) ||
      (await AgenticSessionLocalStore.getOrCreateMomentDoppelgangerSession(uid));

    let samples: Array<{ text: string; at?: string }> = [];
    try {
      samples = JSON.parse(extractVoiceJson(fresh.context));
      if (!Array.isArray(samples)) samples = [];
    } catch {
      samples = [];
    }

    const styleNotes = [
      ...parseStyleNotesFromContext(fresh.context),
      ...(res.styleNotes || []),
    ]
      .map((n) => String(n || '').trim())
      .filter(Boolean)
      .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
      .slice(0, 12);

    const sessionInfo = [
      ...parseSessionInfoFromContext(fresh.context),
      ...(res.sessionInfoLine ? [res.sessionInfoLine] : []),
    ]
      .map((n) => String(n || '').trim())
      .filter(Boolean)
      .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
      .slice(0, 6);

    if (res.voiceSample) {
      const phrase = redactForMomentDoppelganger(res.voiceSample).slice(0, 140);
      if (phrase.length >= 12) {
        samples.unshift({ text: phrase, at: nowIso() });
        samples = samples.slice(0, 32);
      }
    }

    const chatHistory = [...(fresh.chatHistory || [])];
    if (res.conversationBit) {
      chatHistory.push({
        id: `learn_${Date.now().toString(36)}`,
        role: 'assistant',
        content: `[LEARNED] ${String(res.conversationBit).slice(0, 220)}`,
        syncStatus: 'pending',
      });
      // Keep reinforce history tight
      while (chatHistory.length > 40) chatHistory.shift();
    }

    await AgenticSessionLocalStore.upsertSession({
      ...fresh,
      id: momentDoppelgangerSessionId(uid),
      userId: uid,
      targetType: 'momentDoppelganger',
      targetId: uid,
      context: rebuildContext({
        voiceJson: JSON.stringify(samples),
        styleNotes,
        sessionInfo,
      }),
      chatHistory,
    });
  } catch {
    /* background — never block compose */
  }
}

export function recentLearningsFromSession(session: {
  chatHistory?: Array<{ role: string; content: string }>;
  context?: string;
} | null): { styleNotes: string[]; sessionInfo: string[]; learnings: string[] } {
  const styleNotes = parseStyleNotesFromContext(session?.context);
  const sessionInfo = parseSessionInfoFromContext(session?.context);
  const learnings = (session?.chatHistory || [])
    .filter((m) => m.role === 'assistant' && String(m.content || '').startsWith('[LEARNED]'))
    .map((m) => String(m.content || '').replace(/^\[LEARNED\]\s*/, '').trim())
    .filter(Boolean)
    .slice(-6);
  return { styleNotes, sessionInfo, learnings };
}
