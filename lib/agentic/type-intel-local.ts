/**
 * Client-side type-intel helpers — local session + redacted voice ingest.
 * No chat UI. Past objects of this type are the learning substrate.
 */

import {
  AgenticSessionLocalStore,
  typeIntelSessionId,
  typeIntelTargetType,
  type AgenticLocalSession,
} from '@/lib/agentic/session-local-store';
import type { TypeIntelVoiceSample } from '@/lib/agentic/prompts/type-intel';
import {
  TYPE_INTEL_KINDS,
  type TypeIntelKind,
  typeIntelVoicePrefix,
} from '@/lib/agentic/type-intel-kinds';

export function redactForTypeIntel(text: string): string {
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

export async function ensureTypeIntelSession(
  kind: TypeIntelKind,
  userId: string,
): Promise<AgenticLocalSession> {
  return AgenticSessionLocalStore.getOrCreateTypeIntelSession(kind, userId);
}

export function parseTypeIntelSamplesFromSession(
  kind: TypeIntelKind,
  session: AgenticLocalSession | null,
): TypeIntelVoiceSample[] {
  const prefix = typeIntelVoicePrefix(kind);
  const raw = session?.context || '';
  if (!raw.startsWith(prefix)) return [];
  try {
    const parsed = JSON.parse(raw.slice(prefix.length));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row: any) => ({
        text: redactForTypeIntel(String(row?.text || '')),
        at: row?.at ? String(row.at) : undefined,
      }))
      .filter((s: TypeIntelVoiceSample) => Boolean(s.text));
  } catch {
    return [];
  }
}

async function loadCachedList(keys: string[]): Promise<any[]> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  for (const key of keys) {
    const hit = await LocalEngine.cacheGet<any[]>(key);
    if (Array.isArray(hit) && hit.length) return hit;
  }
  return [];
}

/** Pull recent objects of this type into session context. */
export async function refreshTypeIntelVoice(
  kind: TypeIntelKind,
  userId: string,
): Promise<{
  session: AgenticLocalSession;
  samples: TypeIntelVoiceSample[];
  hints: string[];
  status: 'ready' | 'empty';
}> {
  const cfg = TYPE_INTEL_KINDS[kind];
  const session = await ensureTypeIntelSession(kind, userId);
  const rows = await loadCachedList(cfg.listKeys(userId));

  const samples: TypeIntelVoiceSample[] = [];
  for (const row of rows.slice(0, 40)) {
    const text = redactForTypeIntel(cfg.sampleFromRow(row));
    if (text.length < 6) continue;
    samples.push({
      text,
      at: String(row?.$createdAt || row?.createdAt || ''),
    });
    if (samples.length >= 24) break;
  }

  const hints: string[] = [];
  if (cfg.hintKeys && cfg.hintFromRow) {
    try {
      const hintRows = await loadCachedList(cfg.hintKeys(userId));
      for (const row of hintRows.slice(0, 12)) {
        const t = redactForTypeIntel(cfg.hintFromRow(row));
        if (t.length >= 4) hints.push(t);
      }
    } catch {}
  }

  const prefix = typeIntelVoicePrefix(kind);
  await AgenticSessionLocalStore.upsertSession({
    ...session,
    id: typeIntelSessionId(kind, userId),
    userId,
    targetType: typeIntelTargetType(kind),
    targetId: userId,
    context: `${prefix}${JSON.stringify(samples)}`,
    chatHistory: session.chatHistory || [],
  });

  try {
    const { account } = await import('@/lib/appwrite/client');
    const jwt = await account.createJWT().then((r) => r.jwt).catch(() => undefined);
    if (jwt) {
      const { ensureTypeIntelSessionAction } = await import('@/lib/actions/type-intel');
      void ensureTypeIntelSessionAction({
        kind,
        jwt,
        contextSnippet: `${prefix}${JSON.stringify(samples).slice(0, 1500)}`,
      });
    }
  } catch {}

  const fresh =
    (await AgenticSessionLocalStore.getSession(typeIntelSessionId(kind, userId))) || session;
  return {
    session: fresh,
    samples,
    hints: hints.slice(0, 8),
    status: samples.length ? 'ready' : 'empty',
  };
}
