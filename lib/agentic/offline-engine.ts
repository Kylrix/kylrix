/**
 * Dual-Path Offline-First Agentic Engine
 *
 * Provides a deterministic offline intent parser with sub-millisecond
 * syntax heuristics and action chips, along with optimistic LocalEngine +
 * autonomicSyncEngine journaling. Routes to online LLM when connected,
 * falling back transparently if offline or timed out (>3.5s).
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { ulid } from '@/lib/utils/ulid';

export interface OfflineActionChip {
  label: string;
  command: string;
  description: string;
}

export const WORKSPACE_SLASH_COMMANDS: OfflineActionChip[] = [
  { label: '/note', command: '/note ', description: 'Create a note immediately in this workspace' },
  { label: '/goal', command: '/goal ', description: 'Create an actionable goal in this workspace' },
  { label: '/search', command: '/search ', description: 'Search notes, goals, and items locally' },
  { label: '/vault', command: '/vault ', description: 'Find credentials or open vault' },
];

export interface OfflineIntentResult {
  handled: boolean;
  type: 'create_note' | 'create_goal' | 'complete_goal' | 'search' | 'vault' | 'unknown';
  summary: string;
  toolCall?: {
    toolKey: string;
    specifier?: string;
    args?: Record<string, unknown>;
  };
  payload?: any;
}

export interface DualPathExecutionOptions {
  prompt: string;
  workspaceId: string;
  workspaceTitle?: string;
  userId?: string;
  timeoutMs?: number;
  onlineExecutor?: (prompt: string) => Promise<{ success: boolean; response?: string; error?: string }>;
}

export interface DualPathExecutionResult {
  mode: 'online' | 'offline';
  response: string;
  toolCall?: {
    toolKey: string;
    specifier?: string;
    args?: Record<string, unknown>;
  };
  offlineResult?: OfflineIntentResult;
}

/**
 * Parses user prompts deterministically using verb-noun heuristics and slash commands.
 */
export function parseOfflineIntent(prompt: string): {
  verb: string;
  entity: string;
  argument: string;
} | null {
  const text = (prompt || '').trim();
  if (!text) return null;

  // Slash commands
  if (text.startsWith('/note')) {
    return { verb: 'create', entity: 'note', argument: text.replace(/^\/note\s*/i, '').trim() };
  }
  if (text.startsWith('/goal')) {
    return { verb: 'create', entity: 'goal', argument: text.replace(/^\/goal\s*/i, '').trim() };
  }
  if (text.startsWith('/search') || text.startsWith('/find')) {
    return { verb: 'search', entity: 'query', argument: text.replace(/^(\/search|\/find)\s*/i, '').trim() };
  }
  if (text.startsWith('/vault')) {
    return { verb: 'vault', entity: 'query', argument: text.replace(/^\/vault\s*/i, '').trim() };
  }

  // Verb-Noun Heuristics
  // create | draft | add note [title]
  const noteMatch = text.match(/^(?:create|draft|add)\s+(?:a\s+)?note\s*(?::\s*|\s+)?(.+)?$/i);
  if (noteMatch) {
    return { verb: 'create', entity: 'note', argument: (noteMatch[1] || '').trim() };
  }

  // create | add goal [title]
  const goalMatch = text.match(/^(?:create|add)\s+(?:a\s+)?goal\s*(?::\s*|\s+)?(.+)?$/i);
  if (goalMatch) {
    return { verb: 'create', entity: 'goal', argument: (goalMatch[1] || '').trim() };
  }

  // complete | finish goal [title/id]
  const completeGoalMatch = text.match(/^(?:complete|finish|close)\s+(?:the\s+)?goal\s*(?::\s*|\s+)?(.+)?$/i);
  if (completeGoalMatch) {
    return { verb: 'complete', entity: 'goal', argument: (completeGoalMatch[1] || '').trim() };
  }

  // find | search [query]
  const searchMatch = text.match(/^(?:find|search)\s+(?:for\s+)?(.+)$/i);
  if (searchMatch) {
    return { verb: 'search', entity: 'query', argument: searchMatch[1].trim() };
  }

  // vault | credential lookup
  const vaultMatch = text.match(/^(?:view|check|open|find)\s+(?:vault|credentials?|secret|passwords?)(?:\s+(?:for\s+)?(.+))?$/i);
  if (vaultMatch) {
    return { verb: 'vault', entity: 'query', argument: (vaultMatch[1] || '').trim() };
  }

  return null;
}

/**
 * Deterministically executes actions locally against LocalEngine and queues mutations
 * for autonomicSyncEngine sync replay when back online.
 */
export async function executeDeterministicOfflineIntent(
  prompt: string,
  context: {
    workspaceId: string;
    workspaceTitle?: string;
    userId?: string;
  }
): Promise<OfflineIntentResult> {
  const intent = parseOfflineIntent(prompt);
  const uid = context.userId || 'guest';
  const wsId = context.workspaceId || 'personal';

  if (!intent) {
    return {
      handled: false,
      type: 'unknown',
      summary: `I'm running in offline mode. You can use quick actions like \`/note\`, \`/goal\`, or \`/search\` to manage items locally.`,
    };
  }

  // 1. Create Note
  if (intent.verb === 'create' && intent.entity === 'note') {
    const rawTitle = intent.argument || 'Untitled Note';
    const noteId = `note_${ulid()}`;
    const nowIso = new Date().toISOString();
    const isCustomWs = wsId !== 'personal' && wsId !== 'inbox' && wsId !== 'default';

    const notePayload = {
      $id: noteId,
      id: noteId,
      title: rawTitle,
      content: `# ${rawTitle}\n\nDrafted via Workspace Copilot (Offline Engine).`,
      tags: ['workspace', 'copilot'],
      userId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      isWorkspace: isCustomWs,
      projectId: isCustomWs ? wsId : undefined,
    };

    // Optimistic LocalEngine write (0ms)
    await LocalEngine.cacheSet(`note_${noteId}`, notePayload);
    const listKey = uid === 'guest' ? 'f_notes_list_guest' : `f_notes_list_${uid}`;
    const cachedList = (await LocalEngine.cacheGet<any[]>(listKey)) || [];
    await LocalEngine.cacheSet(listKey, [notePayload, ...cachedList.filter((n) => (n.id || n.$id) !== noteId)]);

    // Journal mutation for autonomic sync replay
    try {
      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      autonomicSyncEngine.markPending(noteId, nowIso, notePayload);
    } catch {}

    return {
      handled: true,
      type: 'create_note',
      summary: `Created note: **${rawTitle}** locally. It will sync automatically when back online.`,
      toolCall: {
        toolKey: 'create_note',
        specifier: noteId,
        args: {
          title: rawTitle,
          content: notePayload.content,
          projectId: isCustomWs ? wsId : undefined,
        },
      },
      payload: notePayload,
    };
  }

  // 2. Create Goal
  if (intent.verb === 'create' && intent.entity === 'goal') {
    const rawTitle = intent.argument || 'New Goal';
    const goalId = `goal_${ulid()}`;
    const nowIso = new Date().toISOString();
    const isCustomWs = wsId !== 'personal' && wsId !== 'inbox' && wsId !== 'default';

    const goalPayload = {
      $id: goalId,
      id: goalId,
      title: rawTitle,
      description: `Created via Workspace Copilot (Offline Engine).`,
      status: 'todo',
      priority: 'medium',
      labels: ['copilot'],
      userId: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      isWorkspace: isCustomWs,
      projectId: isCustomWs ? wsId : undefined,
    };

    // Optimistic LocalEngine write
    await LocalEngine.cacheSet(`goal_${goalId}`, goalPayload);
    const listKey = `f_tasks_list_${uid}`;
    const cachedTasks = (await LocalEngine.cacheGet<any[]>(listKey)) || (await LocalEngine.cacheGet<any[]>('f_tasks_list')) || [];
    await LocalEngine.cacheSet(listKey, [goalPayload, ...cachedTasks.filter((g) => (g.id || g.$id) !== goalId)]);

    // Journal mutation
    try {
      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      autonomicSyncEngine.markPending(`goal:${goalId}`, nowIso, goalPayload);
    } catch {}

    return {
      handled: true,
      type: 'create_goal',
      summary: `Created goal: **${rawTitle}** (Status: To Do). Saved locally.`,
      toolCall: {
        toolKey: 'create_goal',
        specifier: goalId,
        args: {
          title: rawTitle,
          status: 'todo',
          projectId: isCustomWs ? wsId : undefined,
        },
      },
      payload: goalPayload,
    };
  }

  // 3. Complete Goal
  if (intent.verb === 'complete' && intent.entity === 'goal') {
    const targetQuery = intent.argument.toLowerCase();
    const listKey = `f_tasks_list_${uid}`;
    let cachedTasks = (await LocalEngine.cacheGet<any[]>(listKey)) || (await LocalEngine.cacheGet<any[]>('f_tasks_list')) || [];
    const matchedGoal = cachedTasks.find((g) => {
      const id = (g.id || g.$id || '').toLowerCase();
      const title = (g.title || '').toLowerCase();
      return id === targetQuery || title.includes(targetQuery);
    });

    if (matchedGoal) {
      const goalId = matchedGoal.id || matchedGoal.$id;
      const nowIso = new Date().toISOString();
      const updatedGoal = {
        ...matchedGoal,
        status: 'completed',
        updatedAt: nowIso,
      };

      await LocalEngine.cacheSet(`goal_${goalId}`, updatedGoal);
      const nextTasks = cachedTasks.map((g) => ((g.id || g.$id) === goalId ? updatedGoal : g));
      await LocalEngine.cacheSet(listKey, nextTasks);

      try {
        const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
        autonomicSyncEngine.markPending(`goal:${goalId}`, nowIso, updatedGoal);
      } catch {}

      return {
        handled: true,
        type: 'complete_goal',
        summary: `Marked goal completed: **${matchedGoal.title}**.`,
        toolCall: {
          toolKey: 'update_goal',
          specifier: goalId,
          args: { status: 'completed' },
        },
        payload: updatedGoal,
      };
    }

    return {
      handled: true,
      type: 'complete_goal',
      summary: `Could not find any matching goal for "${intent.argument}" in local storage.`,
    };
  }

  // 4. Local Search
  if (intent.verb === 'search') {
    const query = intent.argument.toLowerCase();
    const notes = (await LocalEngine.cacheGet<any[]>(uid === 'guest' ? 'f_notes_list_guest' : `f_notes_list_${uid}`)) || [];
    const tasks = (await LocalEngine.cacheGet<any[]>(`f_tasks_list_${uid}`)) || (await LocalEngine.cacheGet<any[]>('f_tasks_list')) || [];

    const matchedNotes = notes.filter((n) => (n.title || '').toLowerCase().includes(query) || (n.content || '').toLowerCase().includes(query)).slice(0, 5);
    const matchedGoals = tasks.filter((t) => (t.title || '').toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query)).slice(0, 5);

    let summaryText = `**Local Search Results for "${intent.argument}":**\n\n`;
    if (!matchedNotes.length && !matchedGoals.length) {
      summaryText += `No matching local notes or goals found.`;
    } else {
      if (matchedNotes.length) {
        summaryText += `**Notes:**\n` + matchedNotes.map((n) => `- ${n.title || 'Untitled'}`).join('\n') + `\n\n`;
      }
      if (matchedGoals.length) {
        summaryText += `**Goals:**\n` + matchedGoals.map((g) => `- [${g.status === 'completed' ? 'x' : ' '}] ${g.title || 'Untitled'}`).join('\n');
      }
    }

    return {
      handled: true,
      type: 'search',
      summary: summaryText,
      toolCall: {
        toolKey: 'search_ecosystem',
        args: { query: intent.argument },
      },
    };
  }

  // 5. Vault Search / Jump
  if (intent.verb === 'vault') {
    return {
      handled: true,
      type: 'vault',
      summary: `Vault credentials cannot be accessed in plain text via agent prompts for security reasons. You can manage your encrypted credentials directly in the Vault app.`,
      toolCall: {
        toolKey: 'ui.navigate',
        args: { route: '/vault' },
      },
    };
  }

  return {
    handled: false,
    type: 'unknown',
    summary: `Unknown offline command. Try \`/note\`, \`/goal\`, or \`/search\`.`,
  };
}

/**
 * Transparent dual-path execution router.
 * Dispatches to online LLM when online, falling back seamlessly to deterministic offline engine
 * if navigator is offline, if the provider fails, or if execution times out (>3.5s).
 */
export async function executeDualPathAgent(
  options: DualPathExecutionOptions
): Promise<DualPathExecutionResult> {
  const { prompt, workspaceId, workspaceTitle, userId, timeoutMs = 3500, onlineExecutor } = options;
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (!isOnline || !onlineExecutor) {
    const offlineResult = await executeDeterministicOfflineIntent(prompt, {
      workspaceId,
      workspaceTitle,
      userId,
    });
    return {
      mode: 'offline',
      response: offlineResult.summary,
      toolCall: offlineResult.toolCall,
      offlineResult,
    };
  }

  // Attempt online execution with strict timeout circuit-breaker
  try {
    const onlinePromise = onlineExecutor(prompt);
    const timeoutPromise = new Promise<{ success: false; timeout: true }>((resolve) =>
      setTimeout(() => resolve({ success: false, timeout: true }), timeoutMs)
    );

    const raceResult = await Promise.race([onlinePromise, timeoutPromise]);

    if ('timeout' in raceResult && raceResult.timeout) {
      console.warn(`[DualPathAgent] Online executor timed out after ${timeoutMs}ms. Gracefully falling back to deterministic offline engine.`);
      const offlineResult = await executeDeterministicOfflineIntent(prompt, {
        workspaceId,
        workspaceTitle,
        userId,
      });
      return {
        mode: 'offline',
        response: `*(Online provider timed out — executed locally)*\n\n${offlineResult.summary}`,
        toolCall: offlineResult.toolCall,
        offlineResult,
      };
    }

    if (raceResult.success && raceResult.response) {
      // Parse tool call if present in LLM response
      let toolCall: DualPathExecutionResult['toolCall'] = undefined;
      try {
        const jsonMatch = raceResult.response.match(/```json\s*(\{[\s\S]*?\})\s*```/) || raceResult.response.match(/(\{[\s\S]*?"toolCall"[\s\S]*?\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed?.toolCall?.toolKey) {
            toolCall = parsed.toolCall;
          }
        }
      } catch {}

      return {
        mode: 'online',
        response: raceResult.response,
        toolCall,
      };
    }

    // If online executor explicitly errored out, fallback to offline engine
    const offlineResult = await executeDeterministicOfflineIntent(prompt, {
      workspaceId,
      workspaceTitle,
      userId,
    });
    return {
      mode: 'offline',
      response: `*(Provider unavailable — executed locally)*\n\n${offlineResult.summary}`,
      toolCall: offlineResult.toolCall,
      offlineResult,
    };
  } catch (err) {
    console.warn('[DualPathAgent] Online executor encountered an error. Falling back to offline engine:', err);
    const offlineResult = await executeDeterministicOfflineIntent(prompt, {
      workspaceId,
      workspaceTitle,
      userId,
    });
    return {
      mode: 'offline',
      response: `*(Network/service error — executed locally)*\n\n${offlineResult.summary}`,
      toolCall: offlineResult.toolCall,
      offlineResult,
    };
  }
}
