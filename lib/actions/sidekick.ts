'use server';

import { Query, ID } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { buildSidekickSystemInstruction, buildSidekickUserPrompt } from '@/lib/agentic/prompts/sidekick';
import { getAgenticUserMessage } from '@/lib/agentic/errors';

async function getActor(jwt?: string) {
  const { getActor } = await import('./secure-ops');
  return getActor(jwt);
}

export async function executeSummarizeAction(opts: { target: { type: string; id: string; title?: string; content?: string; metadata?: any; tags?: string[] }; jwt?: string }) {
  return executeSidekickAction(opts);
}

export async function executeSidekickAction(opts: { target: { type: string; id: string; title?: string; content?: string; metadata?: any; tags?: string[] }; jwt?: string }) {
  try {
    const actor = await getActor(opts.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const target = opts.target;
    if (['vault', 'totp', 'credential', 'secret'].includes(target.type)) {
      return { success: false, error: 'Sidekick is disabled for vault and security items.' };
    }
    const { userHasPaidAiAccess } = await import('@/lib/server/ai-subscription-gate');
    const { AI_REQUIRES_PRO_MESSAGE } = await import('@/lib/agentic/access');
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) {
      return { success: false, error: AI_REQUIRES_PRO_MESSAGE };
    }
    const { databases } = createSystemClient();

    // Lookup existing session for this targetType/targetId
    let existing: any = null;
    try {
      const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
        Query.equal('userId', actor.$id),
        Query.equal('targetType', target.type),
        Query.equal('targetId', target.id),
        Query.limit(1),
      ]);
      if (res.rows.length) existing = res.rows[0];
    } catch {}

    if (existing?.chatHistory) {
      try {
        const hist = JSON.parse(existing.chatHistory);
        const last = [...hist].reverse().find((m: any) => m.role === 'assistant');
        if (last?.content) {
          const parsed = JSON.parse(last.content);
          if (parsed?.oneLiner) return { success: true, result: parsed, sessionId: existing.$id, fromCache: true };
        }
      } catch {}
    }

    // Build dedicated sidekick prompt (robust, focused on object itself, not standard template)
    const systemInstruction = buildSidekickSystemInstruction({
      id: target.id,
      type: target.type as any,
      title: target.title,
      content: target.content,
      metadata: target.metadata,
      tags: target.tags,
    });
    const userPrompt = buildSidekickUserPrompt({
      id: target.id,
      type: target.type as any,
      title: target.title,
      content: target.content,
      metadata: target.metadata,
      tags: target.tags,
    });

    const { generateLLMCompletion } = await import('@/lib/agentic/llm-provider');
    const text = await generateLLMCompletion({
      prompt: userPrompt,
      systemInstruction,
      responseMimeType: 'application/json',
    });

    // Extract JSON
    let parsed: any = null;
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: try to find JSON object in text
      const m = text.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    if (!parsed?.oneLiner) {
      // Fallback shape
      parsed = { oneLiner: text.slice(0, 180), sections: [{ heading: 'Overview', bullets: [text.slice(0, 200)] }], mindMap: { nodes: [{ id: 'c', label: (target.title || 'Central').slice(0, 14), kind: 'central' }], edges: [] } };
    }

    // Persist to agentic session with targetType/targetId — spins up agentic session for this exact target
    const sessionId = existing?.$id || ID.unique();
    const history = existing?.chatHistory ? JSON.parse(existing.chatHistory) : [];
    const userMsg = { role: 'user', content: `Summarize ${target.type} ${target.id}: ${target.title || ''}`.slice(0, 500), at: new Date().toISOString() };
    const assistantMsg = { role: 'assistant', content: JSON.stringify(parsed), at: new Date().toISOString() };
    const newHistory = [...history, userMsg, assistantMsg].slice(-200);

    try {
      if (existing) {
        await databases.updateRow('passwordManagerDb', 'agentic_sessions', existing.$id, {
          chatHistory: JSON.stringify(newHistory),
          context: `Summary: ${target.title || target.id}`.slice(0, 200),
          targetType: target.type,
          targetId: target.id,
          seen: false,
        });
      } else {
        await databases.createRow('passwordManagerDb', 'agentic_sessions', sessionId, {
          userId: actor.$id,
          context: `Summary: ${target.title || target.id}`.slice(0, 200),
          chatHistory: JSON.stringify(newHistory),
          seen: false,
          isMemory: false,
          isPublic: false,
          isGuest: false,
          isPinned: false,
          targetType: target.type,
          targetId: target.id,
        });
      }
    } catch (e) {
      console.error('summarize persist failed', e);
    }

    return { success: true, result: parsed, sessionId };
  } catch (err: any) {
    console.error('executeSidekickAction failed:', err);
    return { success: false, error: getAgenticUserMessage(err) };
  }
}

export async function executeSidekickChat(opts: { target: { type: string; id: string; title?: string; content?: string }; message: string; sessionId?: string; jwt?: string }) {
  try {
    const actor = await getActor(opts.jwt);
    if (!actor?.$id) return { success: false, error: 'Unauthorized' };
    const { userHasPaidAiAccess } = await import('@/lib/server/ai-subscription-gate');
    const { AI_REQUIRES_PRO_MESSAGE } = await import('@/lib/agentic/access');
    const hasAccess = await userHasPaidAiAccess(actor.$id);
    if (!hasAccess) {
      return { success: false, error: AI_REQUIRES_PRO_MESSAGE };
    }
    const { databases } = createSystemClient();
    let session: any = null;
    if (opts.sessionId) {
      try {
        const r = await databases.getRow('passwordManagerDb', 'agentic_sessions', opts.sessionId);
        if ((r as any)?.userId === actor.$id) session = r;
      } catch {}
    }
    if (!session) {
      try {
        const res = await databases.listRows('passwordManagerDb', 'agentic_sessions', [
          Query.equal('userId', actor.$id),
          Query.equal('targetType', opts.target.type),
          Query.equal('targetId', opts.target.id),
          Query.limit(1),
        ]);
        if (res.rows.length) session = res.rows[0];
      } catch {}
    }
    if (!session) {
      const sid = opts.sessionId || (opts.target.id.startsWith('search-') || opts.target.id.startsWith('wallet-') ? opts.target.id : ID.unique());
      try {
        session = await databases.createRow('passwordManagerDb', 'agentic_sessions', sid, {
          userId: actor.$id,
          context: `Sidekick: ${opts.target.title || opts.target.id}`.slice(0, 200),
          chatHistory: '[]',
          seen: false,
          isMemory: false,
          isPublic: false,
          isGuest: false,
          isPinned: false,
          targetType: opts.target.type,
          targetId: opts.target.id,
        });
      } catch {
        try {
          session = await databases.getRow('passwordManagerDb', 'agentic_sessions', sid);
        } catch {}
      }
    }
    if (!session) return { success: false, error: 'Could not resolve sidekick session' };
    const history: any[] = (() => { try { return JSON.parse((session as any).chatHistory || '[]'); } catch { return []; } })();

    // Use sidekick system instruction focused on object itself + chat history
    const { buildSidekickSystemInstruction } = await import('@/lib/agentic/prompts/sidekick');
    const systemInstruction = buildSidekickSystemInstruction({ id: opts.target.id, type: opts.target.type as any, title: opts.target.title, content: opts.target.content });

    const transcript = history
      .map((m: any) => {
        let contentStr = '';
        if (typeof m.content === 'string') {
          const str = m.content.trim();
          if (str.startsWith('{') && str.endsWith('}')) {
            try {
              const parsed = JSON.parse(str);
              if (parsed.oneLiner) {
                contentStr = parsed.oneLiner;
                if (Array.isArray(parsed.sections)) {
                  contentStr += '\n' + parsed.sections.map((s: any) => `${s.heading}: ${Array.isArray(s.bullets) ? s.bullets.join('; ') : ''}`).join('\n');
                }
              } else {
                contentStr = str.slice(0, 2000);
              }
            } catch {
              contentStr = str.slice(0, 2000);
            }
          } else {
            contentStr = str.slice(0, 2000);
          }
        } else {
          contentStr = JSON.stringify(m.content).slice(0, 2000);
        }
        return `${m.role}: ${contentStr}`;
      })
      .join('\n');

    const prompt = `${transcript}\n\nuser: ${opts.message}\n\nContinue as Sidekick for ${opts.target.type} "${opts.target.title || opts.target.id}". Answer the user's questions directly in formatted markdown. Keep focus on this object. Do not return JSON.`;

    const { generateLLMCompletion } = await import('@/lib/agentic/llm-provider');
    const text = await generateLLMCompletion({
      prompt,
      systemInstruction,
    });
    const newHistory = [...history, { role: 'user', content: opts.message, at: new Date().toISOString() }, { role: 'assistant', content: text, at: new Date().toISOString() }].slice(-200);
    try {
      await databases.updateRow('passwordManagerDb', 'agentic_sessions', (session as any).$id, { chatHistory: JSON.stringify(newHistory), seen: false });
    } catch {}
    return { success: true, response: text, sessionId: (session as any).$id };
  } catch (err: any) {
    console.error('executeSidekickChat failed:', err);
    return { success: false, error: getAgenticUserMessage(err) };
  }
}
