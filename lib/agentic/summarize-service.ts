'use client';

import { account } from '@/lib/appwrite/client';

export type SummarizeTarget = {
  type: string;
  id: string;
  title?: string;
  content?: string;
};

/**
 * Get or create a summarize session for a specific object.
 * Stacks on top existing right sidebar instead of replacing — caller opens drawer with returned sessionId.
 * Persists via targetType/targetId so reopening same note shows same conversation.
 */
export async function getOrCreateSummarizeSession(target: SummarizeTarget): Promise<{ sessionId: string; isNew: boolean; chatHistory?: any[] }> {
  const _jwt = await account.createJWT().then((r: any) => r.jwt || '').catch(() => undefined);
  void _jwt;
  // We go via PAT API for DOGFOOD — but for summarize we use client-side AgenticService pattern
  // Instead, call via lib/actions/agentic helpers that already wrap server actions
  const { listAgentSessions } = await import('@/lib/actions/agentic');
  const { account: acc } = await import('@/lib/appwrite/client');
  const j = await acc.createJWT().then((r: any) => r.jwt || '').catch(() => undefined);

  // Try to find existing session for this target via list + filter (server filters via Query equal)
  // Use direct table query via PAT API route if available, fallback to client filtering
  try {
    const sessions: any[] = await listAgentSessions(j);
    const match = sessions.find((s: any) => s.targetType === target.type && s.targetId === target.id);
    if (match) {
      return { sessionId: match.id || match.$id, isNew: false, chatHistory: match.chatHistory ? JSON.parse(match.chatHistory) : undefined };
    }
  } catch {}

  // No existing — create new session via TelemetryService / ApiResources path
  // Use the agentic run path that creates a session row with targetType/targetId
  const { TelemetryService } = await import('@/lib/services/telemetry');
  const user = await acc.get().catch(() => null);
  if (!user) throw new Error('Not authenticated');
  
  // Direct create via system tables if no dedicated endpoint yet — additive, matches resources.ts pattern
  // We create via API route /api/v1/agents/sessions with target fields
  const res = await fetch('/api/v1/agents/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kylrix-jwt': j || '' },
    body: JSON.stringify({
      context: `Summary: ${target.title || target.id}`.slice(0, 200),
      targetType: target.type,
      targetId: target.id,
      isMemory: false,
    }),
  }).catch(() => null);

  if (res?.ok) {
    const data = await res.json().catch(() => ({}));
    const sid = (data as any)?.id || (data as any)?.$id || (data as any)?.rowId;
    if (sid) return { sessionId: sid, isNew: true };
  }

  // Fallback: create via TelemetryService.createSession if endpoint not yet wired for target fields
  try {
    const created: any = await (TelemetryService as any).createSession?.(user.$id, target.title || 'Summary', { targetType: target.type, targetId: target.id });
    if (created?.id) return { sessionId: created.id, isNew: true };
  } catch {}

  // Last resort: generate local id and let first message create the row
  return { sessionId: `summarize_${target.type}_${target.id}_${Date.now()}`, isNew: true };
}
