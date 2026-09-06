/**
 * Client-side Moments doppelganger helpers — local session + redacted voice ingest.
 * No chat UI. Posts, replies, and Nostr voice cache are the learning substrate.
 */

import {
  AgenticSessionLocalStore,
  momentDoppelgangerSessionId,
  type AgenticLocalSession,
} from '@/lib/agentic/session-local-store';
import type { MomentVoiceSample } from '@/lib/agentic/prompts/moment-doppelganger';

const VOICE_CONTEXT_PREFIX = 'MOMENT_VOICE_SAMPLES_V1:';

export function redactForMomentDoppelganger(text: string): string {
  return String(text || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[phone]')
    .replace(/\b[ln](?:pub|sec)1[a-z0-9]{20,}\b/gi, '[key]')
    .replace(/\bsk-[a-zA-Z0-9]{16,}\b/g, '[secret]')
    .replace(/\b0x[a-fA-F0-9]{20,}\b/g, '[wallet]')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);
}

export async function ensureMomentDoppelgangerSession(userId: string): Promise<AgenticLocalSession> {
  return AgenticSessionLocalStore.getOrCreateMomentDoppelgangerSession(userId);
}

export function parseVoiceSamplesFromSession(session: AgenticLocalSession | null): MomentVoiceSample[] {
  const raw = session?.context || '';
  if (!raw.startsWith(VOICE_CONTEXT_PREFIX)) return [];
  try {
    const parsed = JSON.parse(raw.slice(VOICE_CONTEXT_PREFIX.length));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row: any) => ({
        text: redactForMomentDoppelganger(String(row?.text || '')),
        at: row?.at ? String(row.at) : undefined,
      }))
      .filter((s: MomentVoiceSample) => Boolean(s.text));
  } catch {
    return [];
  }
}

/** Pull recent moments (+ replies + Nostr voice cache + idea/goal titles) into session context. */
export async function refreshMomentDoppelgangerVoice(
  userId: string,
): Promise<{ session: AgenticLocalSession; samples: MomentVoiceSample[]; hints: string[]; status: 'ready' | 'empty' }> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const session = await ensureMomentDoppelgangerSession(userId);

  const moments =
    (await LocalEngine.cacheGet<any[]>('f_moments_list')) ||
    (await LocalEngine.cacheGet<any[]>(`f_moments_list_${userId}`)) ||
    [];

  const own = (Array.isArray(moments) ? moments : [])
    .filter((m) => String(m?.userId || m?.creatorId || '') === userId)
    .sort((a, b) => {
      const ta = Date.parse(String(a?.$createdAt || a?.createdAt || 0)) || 0;
      const tb = Date.parse(String(b?.$createdAt || b?.createdAt || 0)) || 0;
      return tb - ta;
    })
    .slice(0, 60);

  const samples: MomentVoiceSample[] = [];
  const seen = new Set<string>();

  const pushSample = (raw: string, at?: string) => {
    const text = redactForMomentDoppelganger(raw);
    if (text.length < 8) return;
    const key = text.slice(0, 80).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    samples.push({ text, at });
  };

  for (const m of own) {
    // Learn from posts AND replies (social layer)
    pushSample(
      String(m?.caption || m?.content || m?.searchTitle || ''),
      String(m?.$createdAt || m?.createdAt || ''),
    );
    if (samples.length >= 28) break;
  }

  // Own Nostr-published voice cache (when dual-synced from composer)
  try {
    const nostrSamples =
      (await LocalEngine.cacheGet<any[]>(`f_nostr_voice_samples_${userId}`)) || [];
    for (const row of Array.isArray(nostrSamples) ? nostrSamples.slice(0, 20) : []) {
      pushSample(String(row?.text || ''), String(row?.at || ''));
      if (samples.length >= 32) break;
    }
  } catch {}

  const hints: string[] = [];
  try {
    const notes =
      (await LocalEngine.cacheGet<any[]>(`f_notes_list_${userId}`)) ||
      (await LocalEngine.cacheGet<any[]>('f_notes_list')) ||
      [];
    for (const n of Array.isArray(notes) ? notes.slice(0, 12) : []) {
      const t = redactForMomentDoppelganger(String(n?.title || ''));
      if (t.length >= 4) hints.push(t);
    }
  } catch {}
  try {
    const goals =
      (await LocalEngine.cacheGet<any[]>(`f_goals_list_${userId}`)) ||
      (await LocalEngine.cacheGet<any[]>('f_goals_list')) ||
      [];
    for (const g of Array.isArray(goals) ? goals.slice(0, 12) : []) {
      const t = redactForMomentDoppelganger(String(g?.title || g?.name || ''));
      if (t.length >= 4) hints.push(`goal:${t}`);
    }
  } catch {}

  await AgenticSessionLocalStore.upsertSession({
    ...session,
    id: momentDoppelgangerSessionId(userId),
    userId,
    targetType: 'momentDoppelganger',
    targetId: userId,
    context: `${VOICE_CONTEXT_PREFIX}${JSON.stringify(samples)}`,
    chatHistory: session.chatHistory || [],
  });

  // Remote never-dup ensure at most once per day (LocalEngine gate)
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const ensureGateKey = `f_moment_remote_ensure_${userId}`;
    const lastEnsure = Number((await LocalEngine.cacheGet<number>(ensureGateKey)) || 0);
    const ENSURE_TTL_MS = 24 * 60 * 60 * 1000;
    if (!lastEnsure || Date.now() - lastEnsure > ENSURE_TTL_MS) {
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
      if (jwt) {
        const { ensureMomentDoppelgangerSessionAction } = await import('@/lib/actions/moment-doppelganger');
        void ensureMomentDoppelgangerSessionAction({
          jwt,
          contextSnippet: `${VOICE_CONTEXT_PREFIX}${JSON.stringify(samples).slice(0, 1500)}`,
        });
        void LocalEngine.cacheSet(ensureGateKey, Date.now());
      }
    }
  } catch {}

  const fresh = (await AgenticSessionLocalStore.getSession(momentDoppelgangerSessionId(userId))) || session;
  return {
    session: fresh,
    samples,
    hints: hints.slice(0, 8),
    status: samples.length ? 'ready' : 'empty',
  };
}
