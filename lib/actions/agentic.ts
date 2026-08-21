'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ID, Query } from 'node-appwrite';

import { createSystemClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite/server';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';
import { AI_REQUIRES_PRO_MESSAGE } from '@/lib/agentic/access';
import { resolveAgenticError, type AgenticErrorCode } from '@/lib/agentic/errors';





import { getActor } from './secure-ops';

// ... (rest of imports)

async function requireUser(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return actor;
}

async function checkComputeBalance(userId: string) {
  const hasAccess = await userHasPaidAiAccess(userId);
  if (!hasAccess) {
    throw new Error(AI_REQUIRES_PRO_MESSAGE);
  }

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    'passwordManagerDb',
    'compute_balances',
    [Query.equal('userId', userId), Query.limit(1)]
  );

  let balanceRow: any = null;
  if (res.rows.length === 0) {
    balanceRow = await databases.createRow(
      'passwordManagerDb',
      'compute_balances',
      ID.unique(),
      {
        userId,
        tier: 'pro',
        balance: 100000,
        lastResetAt: new Date().toISOString()
      }
    );
  } else {
    balanceRow = res.rows[0];
  }

  if (balanceRow.balance <= 0) {
    throw new Error('You have exceeded your dynamic compute token allocation.');
  }
  return balanceRow;
}

async function debitComputeBalance(userId: string, balanceRow: any, promptText: string, completionText: string) {
  const { databases } = createSystemClient();
  const promptLength = promptText.length || 0;
  const estimatedPromptTokens = Math.ceil(promptLength / 4) + 120;
  const estimatedCompletionTokens = Math.ceil(completionText.length / 4);
  const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;

  const newBalance = Math.max(0, balanceRow.balance - totalTokens);
  await databases.updateRow(
    'passwordManagerDb',
    'compute_balances',
    balanceRow.$id,
    { balance: newBalance }
  );

  await databases.createRow(
    'passwordManagerDb',
    'compute_ledger',
    ID.unique(),
    {
      userId,
      tokensConsumed: totalTokens,
      timestamp: new Date().toISOString()
    }
  );
}




export async function executeInstantRequestAction(
  prompt: string,
  jwt?: string,
  pageContext?: {
    zone: string;
    route: string;
    title: string;
    systemHint: string;
    resourceId?: string;
    /** Exact user-facing sentence for chat history. Model still receives `prompt`. */
    userMessage?: string;
  },
  options?: {
    userMessage?: string;
  }): Promise<{
  success: boolean;
  response: string;
  errorCode?: AgenticErrorCode;
  toolCalls?: any[];
  nextSteps?: Array<{ label: string; prompt: string }>;
  sessionId?: string;
  conversationId?: string;
}> {
  try {
  return await executeInstantRequestActionInner(prompt, jwt, pageContext, options);
  } catch (error) {
    const resolved = resolveAgenticError(error);
    console.error('[executeInstantRequestAction]', resolved.code, resolved.debugMessage || error);
    return {
      success: false,
      response: resolved.userMessage,
      errorCode: resolved.code};
  }
}

async function executeInstantRequestActionInner(
  prompt: string,
  jwt?: string,
  pageContext?: {
    zone: string;
    route: string;
    title: string;
    systemHint: string;
    resourceId?: string;
    /** Exact user-facing sentence for chat history. Model still receives `prompt`. */
    userMessage?: string;
  },
  options?: {
    userMessage?: string;
  }): Promise<{
  success: boolean;
  response: string;
  errorCode?: AgenticErrorCode;
  toolCalls?: any[];
  nextSteps?: Array<{ label: string; prompt: string }>;
  sessionId?: string;
  conversationId?: string;
}> {
  const user = await requireUser(jwt);
  const hasAiProvider = Boolean(
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_HOST ||
    process.env.OPENAI_BASE_URL ||
    process.env.LOCAL_AI_BASE_URL ||
    process.env.GOOGLE_API_KEY
  );
  if (!hasAiProvider) {
    throw new Error('AI is not configured. Please set OLLAMA_BASE_URL, OPENAI_BASE_URL, or GOOGLE_API_KEY.');
  }

  const { TelemetryService } = await import('@/lib/services/telemetry');
  const balanceRow = await checkComputeBalance(user.$id);
  const { databases } = createSystemClient();

  // 1. Fetch preferences to see if chat history is allowed
  let historyEnabled = true;
  let activeSessionId: string | undefined = undefined;
  try {
    const { account } = await createServerClient(jwt);
    const appPrefs = await account.getPrefs();
    if ((appPrefs as any)?.smartSystemHistory === false) {
      historyEnabled = false;
    }
    activeSessionId = (appPrefs as any)?.activeAgentSessionId;
  } catch {}

  // 2. Load historical compressed session context, recent messages, and lifetime Memory (C0)
  let sessionContext = "";
  let recentMessagesStr = "";
  let sessionData: any = null;
  let lifetimeMemoryContext = "";
  let sessionObjectsSnippet = "No session objects yet.";

  if (historyEnabled) {
    const [sessionLoad, memoryLoad] = await Promise.all([
      TelemetryService.loadSession(user.$id, activeSessionId),
      TelemetryService.loadMemory(user.$id)
    ]);
    sessionData = sessionLoad;
    if (sessionData?.rowId) {
      activeSessionId = sessionData.rowId;
    }
    if (!activeSessionId) {
      activeSessionId = await TelemetryService.saveSession(user.$id, '', '[]', false);
      try {
        const { account } = await createServerClient(jwt);
        const prefs = await account.getPrefs().catch(() => ({}));
        await account.updatePrefs({ ...prefs, activeAgentSessionId: activeSessionId }).catch(() => {});
      } catch {}
      sessionData = { context: '', chatHistory: '[]', seen: false, rowId: activeSessionId };
    }
    sessionContext = sessionData.context || "";
    lifetimeMemoryContext = memoryLoad.context || "";
    try {
      const historyArr = JSON.parse(sessionData.chatHistory || '[]');
      const tail = historyArr.slice(-15);
      recentMessagesStr = tail
        .map((m: any) => {
          const blockText = Array.isArray(m.blocks)
            ? m.blocks
                .map((b: any) => (b.type === 'markdown' ? b.content : b.type === 'ecosystem_hits' ? `[hits for "${b.query}": ${Array.isArray(b.hits) ? b.hits.map((h: any) => h.id).join(', ') : ''}]` : ''))
                .join('\n')
            : '';
          const combined = [m.content, blockText].filter(Boolean).join('\n');
          return `${m.role === 'user' ? 'User' : 'Agent'}: ${combined}`;
        })
        .join('\n');
    } catch {}

    if (activeSessionId) {
      const sessionObjects = await TelemetryService.listSessionObjects(user.$id, activeSessionId, 40);
      if (sessionObjects.length > 0) {
        sessionObjectsSnippet = sessionObjects
          .map(
            (o) =>
              `- type=${o.objectType} id=${o.objectId} title="${(o.title || '').replace(/"/g, "'")}" tool=${o.toolKey || 'n/a'}`)
          .join('\n');
      }
    }
  }

  let telemetrySnippet = "No recent behavior patterns logged.";
  let userResourceSummaries = "No active resources loaded.";
  let notesRes: any = null;
  let tasksRes: any = null;
  let projectsRes: any = null;

  try {
    // Fetch recent activity for anonymized pattern matches
    const recentActivity = await databases.listRows(
      'passwordManagerDb',
      'app_activity_logs',
      [Query.equal('userId', user.$id), Query.orderDesc('$createdAt'), Query.limit(8)]
    );
    if (recentActivity.rows.length > 0) {
      telemetrySnippet = recentActivity.rows.map((r: any) => `- Action: ${r.action} in Niche: ${r.niche} (${r.$createdAt})`).join('\n');
    }

    // Fetch basic structural context for Notes/Goals/Projects to allow AI to know about active records
    const resolved = await Promise.all([
      databases.listRows('passwordManagerDb', '67ff05f3002502ef239e', [
        Query.equal('userId', user.$id),
        Query.orderDesc('$updatedAt'),
        Query.limit(8),
      ]),
      databases.listRows('passwordManagerDb', 'tasks', [
        Query.equal('userId', user.$id),
        Query.notEqual('isTrash', true),
        Query.orderDesc('$updatedAt'),
        Query.limit(6),
      ]),
      databases.listRows('passwordManagerDb', 'projects', [
        Query.equal('ownerId', user.$id),
        Query.notEqual('isTrash', true),
        Query.orderDesc('$updatedAt'),
      ]),
    ]);
    notesRes = resolved[0];
    tasksRes = resolved[1];
    projectsRes = resolved[2];

    const recentIdeaTitles = (notesRes?.rows || [])
      .filter((n: any) => n.isTrash !== true)
      .map((n: any) => String(n.title || '').trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((t: string) => `- "${t}"`)
      .join('\n');

    const activeNotes = (notesRes.rows || [])
      .filter((n: any) => n.isTrash !== true)
      .slice(0, 5)
      .map((n: any) => `- Note ID: ${n.$id}, Title: "${n.title}"`)
      .join('\n');
    const activeTasks = (tasksRes.rows || [])
      .map((t: any) => `- Goal/Task ID: ${t.$id}, Title: "${t.title}" (Status: ${t.status}${t.isAgentic ? ', Kylie-made' : ''})`)
      .join('\n');
    const activeProjects = (projectsRes.rows || [])
      .map((p: any) => `- Project ID: ${p.$id}, Title: "${p.title}"`)
      .join('\n');

    userResourceSummaries = `
[RECENT IDEA TITLES — TITLES ONLY]
${recentIdeaTitles || 'None'}

Active Notes:
${activeNotes || 'None'}
Active Goals/Tasks:
${activeTasks || 'None'}
Active Projects:
${activeProjects || 'None'}
`;
  } catch (err) {
    console.error('[executeInstantRequestAction] Failed to retrieve context details:', err);
  }

  // Pre-analyze delete/modify intent to feed the AI hint context
  let hintContext = "";
  const userMsgText = String(pageContext?.userMessage || options?.userMessage || prompt || "").trim();
  const isDeleteIntent = /\b(delete|remove|trash|purge|discard|destroy|clear)\b/i.test(userMsgText);
  if (isDeleteIntent) {
    const matchedResources: string[] = [];
    const lowerMessage = userMsgText.toLowerCase();
    
    // Check notes
    if (notesRes && notesRes.rows) {
      for (const note of notesRes.rows) {
        const title = String(note.title || "").toLowerCase();
        if (title && (lowerMessage.includes(title) || (note.$id && lowerMessage.includes(note.$id.toLowerCase())))) {
          matchedResources.push(`- Note ID: ${note.$id}, Title: "${note.title}"`);
        }
      }
    }
    // Check tasks
    if (tasksRes && tasksRes.rows) {
      for (const task of tasksRes.rows) {
        const title = String(task.title || "").toLowerCase();
        if (title && (lowerMessage.includes(title) || (task.$id && lowerMessage.includes(task.$id.toLowerCase())))) {
          matchedResources.push(`- Goal/Task ID: ${task.$id}, Title: "${task.title}"`);
        }
      }
    }
    // Check projects
    if (projectsRes && projectsRes.rows) {
      for (const project of projectsRes.rows) {
        const title = String(project.title || "").toLowerCase();
        if (title && (lowerMessage.includes(title) || (project.$id && lowerMessage.includes(project.$id.toLowerCase())))) {
          matchedResources.push(`- Project ID: ${project.$id}, Title: "${project.title}"`);
        }
      }
    }

    if (matchedResources.length > 0) {
      hintContext = `
[FRAMEWORK DELETE PRE-ANALYSIS]
The user prompt indicates a delete/removal request. The framework pre-scan matched these potential target resources:
${matchedResources.join('\n')}
If one of these matches the user's request, you should output a toolCall for delete_resource targeting that resource ID with the correct type.
`;
    } else {
      hintContext = `
[FRAMEWORK DELETE PRE-ANALYSIS]
The user prompt indicates a delete/removal request, but no exact matching resource title or ID was found in the recent list.
If the target is ambiguous, ask the user to clarify or list the available titles for them to choose from, or suggest next steps.
`;
    }
  }

  // Fast-path: user literally typed tool syntax (e.g. `search_ecosystem { query: "..." }`). Bypass LLM and emit that toolCall directly.
  const explicitTool = (() => {
    const raw = String(prompt || '').trim();
    // pick this idea (ID)
    const pickMatch = raw.match(/pick this idea\s*\(?\s*([a-f0-9]{24,})\s*\)?/i);
    if (pickMatch) return { toolKey: 'get_note', specifier: pickMatch[1], args: {} };
    // explicit get_note with id
    const getMatch = raw.match(/get_note\s*[:\s]*([a-f0-9]{24,})/i);
    if (getMatch) return { toolKey: 'get_note', specifier: getMatch[1], args: {} };
    // search_ecosystem { query: "..." }  or  search_ecosystem query "..."
    const searchMatch = raw.match(/search_ecosystem\s*\{[^}]*query\s*:\s*["']([^"']+)["'][^}]*\}/i) || raw.match(/search_ecosystem\s*\{[^}]*query\s*:\s*["']([^"']+)["']/i);
    if (searchMatch) return { toolKey: 'search_ecosystem', args: { query: searchMatch[1] } };
    // create_note { title: "...", content: "..." }
    if (/create_note\s*\{/i.test(raw)) {
      try {
        const jsonPart = raw.slice(raw.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        if (parsed && typeof parsed.title === 'string') {
          return { toolKey: 'create_note', args: { title: parsed.title, content: String(parsed.content || ''), tags: parsed.tags, isPublic: parsed.isPublic } };
        }
      } catch {}
    }
    return null;
  })();
  if (explicitTool) {
    const userVisibleMessage = String(prompt || '').trim().slice(0, 500);
    const userMessageId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Persist explicit user intent as history before returning toolCall
    try {
      if (historyEnabled) {
        let historyArr: any[] = [];
        try { historyArr = JSON.parse(sessionData?.chatHistory || '[]'); } catch {}
        historyArr.push({ id: userMessageId, role: 'user', content: userVisibleMessage });
        historyArr.push({ id: conversationId, role: 'assistant', content: '', nextSteps: [] });
        let nextContext = sessionContext;
        await TelemetryService.saveSession(user.$id, nextContext, JSON.stringify(historyArr), false, sessionData?.rowId || activeSessionId);
      }
    } catch {}
    return {
      success: true,
      response: '',
      toolCalls: [explicitTool],
      nextSteps: [],
      sessionId: sessionData?.rowId || activeSessionId || undefined,
      conversationId,
    };
  }

  // Redact potentially sensitive details (passwords, PINs, auth keys) in prompt
  const redactedPrompt = prompt
    .replace(/(password|pass|pin|secret|key|private)\s*[:=]\s*[^\s]+/gi, '$1: [REDACTED]')
    .replace(/(?<=^|\s)[A-Za-z0-9+/]{40}(?=$|\s)/g, '[REDACTED_HASH]');

  const { assembleSystemInstructionBlocks } = await import('@/lib/agentic/prompt-framework');
  const DATA_STRUCTURES_GUIDE = `
[KYLRIX DATA ECOSYSTEM STRUCTURES & SCHEMAS]
1. Database Consolidation: All tables live in database: "passwordManagerDb".
2. Idea / Note table (canonical):
   - tableId: "67ff05f3002502ef239e" (product name: Idea; code: notes)
   - Row fields the agent may set via tools: title (string), content (markdown string), tags (string[]), isPublic (boolean), isGuest (boolean)
   - System-owned fields (DO NOT invent or set): $id, userId, $createdAt, $updatedAt, dek, isTrash, collaborators
   - Creating an Idea ALWAYS requires toolKey "create_note" with args { title, content } at minimum.
3. Other tables:
   - "67ff06280034908cf08a" (Tags): { userId, name, color, isTrash }
   - "tasks" (Goals): { userId, title, status, priority, dueDate, description, isAgentic, isTrash }
   - "events": { userId, title, startTime, endTime, isTrash }
   - "forms": { userId, title, schema, settings, isTrash }
   - "projects": { ownerId, title, summary, isTrash }

[GOALS — ALWAYS ON]
- Goals are the primary productivity object. Infuse goal-oriented next steps on every page (Ideas, Flow, Vault, Connect, Projects).
- When Kylie creates a goal, set args.isAgentic = true so it is marked as Kylie-made.

[NEXT STEPS CONTRACT — DEAD ACCURATE]
- Nearly every helpful reply SHOULD include toolKey "suggest_next_steps" with 2–4 suggestions.
- Each suggestion: { "label": "short chip", "prompt": "complete instruction that will fully execute when clicked" }.
- Ground suggestions in: live chat, [RECENT IDEA TITLES], Active Goals/Projects, and [USER RECENT TELEMETRY HISTORY] habits.
- Prefer concrete chips like: "Create a goal for …", "Connect this idea to project …", "Open Flow", "Draft a follow-up idea".
- The prompt field must be executable by Kylie alone (no clarifying questions unless absolutely required). One click = full flow via tools.

[SESSION OBJECTS — THIS THREAD]
Objects already created or opened in this agent session (prefer these ids for update_note / get_note):
${sessionObjectsSnippet}

[SECURITY ACCESS CONTROL]
- Secrets, TOTP Secrets, Logins, and Passwords tables are mathematically EXCLUDED from the agent context. You do not have access to these and should never ask for or handle credentials.

[USER RECENT TELEMETRY HISTORY]
${telemetrySnippet}

[USER DATA CONTEXT SUMMARY]
${userResourceSummaries}
`;

  const contextBlock = pageContext
    ? [
        `Active page: ${pageContext.title} (${pageContext.zone})`,
        `Route: ${pageContext.route}`,
        pageContext.resourceId ? `Focused resource: ${pageContext.resourceId}` : null,
        `Page guidance: ${pageContext.systemHint}`,
      ]
        .filter(Boolean)
        .join('\n')
    : null;

  const sessionBlock = historyEnabled && (sessionContext || recentMessagesStr)
    ? `
[SESSION COMPRESSED CONTEXT]
${sessionContext}

[RECENT MESSAGES CHAT HISTORY]
${recentMessagesStr}
`
    : "";

  const memoryBlock = historyEnabled && lifetimeMemoryContext
    ? `
[LIFETIME LONG-TERM MEMORY (C0)]
${lifetimeMemoryContext}
`
    : "";

  const systemInstructionCore = assembleSystemInstructionBlocks({
    dataStructuresGuide: DATA_STRUCTURES_GUIDE,
    contextBlock,
    sessionBlock,
    memoryBlock,
    hintContext,
    telemetrySnippet,
    userResourceSummaries,
    sessionObjectsSnippet});

  const fullSystemInstruction = [
    systemInstructionCore,
    'JSON OUTPUT SCHEMA (STRICT):',
    '{',
    '  "response": "Visible reply to the user (markdown). Required.",',
    '  "sessionContextUpdate": "Optional facts to append to session context.",',
    '  "lifetimeMemoryUpdate": "Optional high-quality lifelong memory. Leave blank if none.",',
    '  "toolCalls": [',
    '     {',
    '        "toolKey": "wallet_get_balance | wallet_send_tokens | search_users | create_note | update_note | get_note | create_goal | update_goal | list_goals | create_project | ui.navigate | navigate_workspace | search_ecosystem | objects.form.read | objects.form.submit | link_to_project | suggest_next_steps | toggle_privacy | delete_resource | ui.open_drawer | ui.preview.open",',
    '        "specifier": "resource id, form id, target id, or \'.all\' when required; null otherwise",',
    '        "subSpecifier": "optional field name",',
    '        "args": { "token": "KYLRIX|SOL|ALL", "amount": "...", "recipientUsername": "...", "title": "...", "content": "...", "description": "...", "query": ".all", "target": "settings.passkeys", "route": "/settings", "tags": [], "isPublic": false, "isAgentic": true, "suggestions": [{ "label": "...", "prompt": "..." }], "objectType": "note", "objectId": "...", "type": "note", "payload": {} }',
    '     }',
    '  ]',
    '}',
    'WALLET EXAMPLE — user says "check my kylrix balance" or "fetch my balance":',
    '{"response":"Retrieving your on-chain wallet balances and addresses.","toolCalls":[{"toolKey":"wallet_get_balance","args":{"token":"KYLRIX"}}]}',
    'NAVIGATION EXAMPLE — user says "take me to passkeys in settings":',
    '{"response":"Opening Passkeys in Settings now.","toolCalls":[{"toolKey":"ui.navigate","args":{"target":"settings.passkeys"}}]}',
    'SEARCH EXAMPLE — user says "what is for today":',
    '{"response":"Searching your goals and events for today.","toolCalls":[{"toolKey":"search_ecosystem","args":{"query":"what is for today"}}]}',
  ].join('\n');

  const { generateLLMCompletion } = await import('@/lib/agentic/llm-provider');
  const responseTextRaw = await generateLLMCompletion({
    prompt: redactedPrompt,
    systemInstruction: fullSystemInstruction,
    responseMimeType: 'application/json',
  });

  let visibleResponse = responseTextRaw;
  let sessionUpdate = "";
  let memoryUpdate = "";
  let isThreadCompletedVal: number | undefined = undefined;
  let parsedToolCalls: any[] | undefined = undefined;
  let parsedNextSteps: Array<{ label: string; prompt: string }> | undefined = undefined;

  try {
    const parsed = JSON.parse(responseTextRaw);
    const hasToolCalls = Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0;
    // When model emits only toolCalls (e.g. {"toolCalls": [...]}) with no response, don't store raw JSON as visible text
    if (hasToolCalls && typeof parsed.response !== 'string') {
      visibleResponse = '';
    } else {
      visibleResponse = typeof parsed.response === 'string' ? parsed.response : responseTextRaw;
    }
    sessionUpdate = parsed.sessionContextUpdate || "";
    memoryUpdate = parsed.lifetimeMemoryUpdate || "";
    isThreadCompletedVal = parsed.isThreadCompleted;
    if (Array.isArray(parsed.toolCalls)) {
      parsedToolCalls = parsed.toolCalls;
    }
    if (Array.isArray(parsed.nextSteps)) {
      parsedNextSteps = parsed.nextSteps;
    }
  } catch {
    visibleResponse = responseTextRaw;
  }

  // Keep parse field available for future session lifecycle without unused-lint noise.
  void isThreadCompletedVal;

  // Flatten suggest_next_steps tool into nextSteps for history + UI.
  const fromTool = (parsedToolCalls || [])
    .filter((c: any) => c?.toolKey === 'suggest_next_steps')
    .flatMap((c: any) => (Array.isArray(c?.args?.suggestions) ? c.args.suggestions : []));
  const nextStepsForHistory = [...(parsedNextSteps || []), ...fromTool]
    .map((item: any) => ({
      label: String(item?.label || '').trim(),
      prompt: String(item?.prompt || '').trim()}))
    .filter((s) => s.label && s.prompt)
    .slice(0, 4);

  await debitComputeBalance(user.$id, balanceRow, prompt, visibleResponse);

  const extractVisibleUserMessage = (rawPrompt: string, override?: string) => {
    if (override && override.trim()) return override.trim();
    const match = rawPrompt.match(/User request:\s*([\s\S]*)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
    return rawPrompt.trim();
  };
  const userVisibleMessage = extractVisibleUserMessage(
    prompt,
    options?.userMessage || pageContext?.userMessage);
  const userMessageId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conversationId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 3. Compact and update session data
  if (historyEnabled) {
    try {
      let historyArr = [];
      try {
        historyArr = JSON.parse(sessionData?.chatHistory || '[]');
      } catch {}

      // Persist the user's exact words — never the behind-the-hood model prompt template.
      historyArr.push({ id: userMessageId, role: 'user', content: userVisibleMessage });
      historyArr.push({
        id: conversationId,
        role: 'assistant',
        content: visibleResponse,
        ...(nextStepsForHistory.length ? { nextSteps: nextStepsForHistory } : {})});

      let nextContext = sessionContext;
      if (sessionUpdate) {
        nextContext = nextContext ? `${nextContext}\n- ${sessionUpdate}` : `- ${sessionUpdate}`;
      }

      // Compact behind-the-hood session context only — never wipe live chatHistory.
      if (historyArr.length >= 6) {
        try {
          nextContext = await compressSessionContext({
            apiKey,
            oldContext: nextContext,
            history: historyArr.slice(-8)});
        } catch (compactErr) {
          console.warn('[executeInstantRequestAction] Context compact failed:', compactErr);
        }
      }

      await TelemetryService.saveSession(
        user.$id,
        nextContext,
        JSON.stringify(historyArr),
        false,
        sessionData?.rowId || activeSessionId);

      // Save high-quality lifetime memory updates if specified
      if (memoryUpdate) {
        const nextLifetimeMemory = lifetimeMemoryContext 
          ? `${lifetimeMemoryContext}\n- ${memoryUpdate}` 
          : `- ${memoryUpdate}`;
        await TelemetryService.saveMemory(user.$id, nextLifetimeMemory);
      }
    } catch (err) {
      console.error('[executeInstantRequestAction] Failed to update session:', err);
    }
  }

  // Log highly anonymized stripped telemetry
  try {
    const activeRoutePointers = pageContext ? `${pageContext.zone}:${pageContext.resourceId || 'none'}` : 'workspace';
    await TelemetryService.recordAgenticTelemetry({
      userId: user.$id,
      action: 'instant_request',
      zone: pageContext?.zone || 'workspace',
      pointers: activeRoutePointers,
      metadata: {
        promptLength: prompt.length,
        responseLength: visibleResponse.length,
        historyEnabled
      }
    });
  } catch (err) {
    console.error('Failed to log anonymized agentic telemetry:', err);
  }

  return {
    success: true,
    response: visibleResponse,
    toolCalls: parsedToolCalls,
    nextSteps: nextStepsForHistory,
    sessionId: sessionData?.rowId || activeSessionId || undefined,
    conversationId};
}

export async function getAgentSession(jwt?: string) {
  const user = await requireUser(jwt);
  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  let activeSessionId = (prefs as any)?.activeAgentSessionId;

  const { TelemetryService } = await import('@/lib/services/telemetry');
  
  let session = null;
  if (activeSessionId) {
    session = await TelemetryService.loadSession(user.$id, activeSessionId);
  }

  if (!session || !session.rowId) {
    session = await TelemetryService.loadSession(user.$id);
    if (session.rowId) {
      activeSessionId = session.rowId;
      await account.updatePrefs({ ...prefs, activeAgentSessionId: activeSessionId }).catch(() => {});
    } else {
      const newSessionId = await TelemetryService.saveSession(user.$id, '', '[]', false);
      activeSessionId = newSessionId;
      await account.updatePrefs({ ...prefs, activeAgentSessionId: activeSessionId }).catch(() => {});
      session = { context: '', chatHistory: '[]', seen: false, rowId: newSessionId };
    }
  }

  return session;
}

const SESSION_COMPACTOR_SYSTEM = `You are the Kylrix session context compressor.
Your job: produce an ultra-dense continuity brief for a future assistant turn.

HARD RULES:
1. Preserve SPECIFICS — exact names, IDs, routes, tool outcomes, numbers, constraints, user preferences, workflow steps, and stated nuances. Never generalize these away.
2. Drop fluff — greetings, repeated acknowledgements, filler, and redundant restatements.
3. Prefer short bullet lines. No preamble, no markdown fences, no commentary about compression.
4. If old context and new chats conflict, prefer the newer user-stated facts while keeping unresolved open threads.
5. Keep enough detail that a fresh session can continue without re-asking for specifics the user already gave.`;

async function compressSessionContext(params: {
  apiKey: string;
  oldContext: string;
  history: Array<{ role?: string; content?: string }>;
}): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(params.apiKey);
  const compactModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SESSION_COMPACTOR_SYSTEM});

  const transcript = (params.history || [])
    .map((m: any) => {
      const body = typeof m.content === 'string' ? m.content.trim() : '';
      if (!body) return '';
      return `${m.role === 'user' ? 'User' : 'Agent'}: ${body}`;
    })
    .filter(Boolean)
    .join('\n');

  const prompt = `Compress the following into a continuity brief.

OLD SESSION CONTEXT:
${params.oldContext?.trim() || '(empty)'}

RECENT TRANSCRIPT:
${transcript || '(empty)'}

OUTPUT: ultra-dense continuity brief only.`;

  const compactRes = await compactModel.generateContent(prompt);
  return compactRes.response.text().trim();
}

export async function startNewAgentSession(jwt?: string) {
  const user = await requireUser(jwt);
  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  
  const { TelemetryService } = await import('@/lib/services/telemetry');
  const newSessionId = await TelemetryService.saveSession(user.$id, '', '[]', false);
  
  await account.updatePrefs({ ...prefs, activeAgentSessionId: newSessionId }).catch(() => {});
  return { success: true, sessionId: newSessionId };
}

/** Fork a fresh session from a prompt card. Optionally seed with compressed prior-session context. */
export async function startNewAgentSessionFromPromptAction(
  params: {
    starterPrompt: string;
    carryContext?: boolean;
    sourceSessionId?: string;
  },
  jwt?: string) {
  const user = await requireUser(jwt);
  const starter = String(params.starterPrompt || '').trim();
  if (!starter) return { success: false as const, error: 'Empty prompt' };

  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  const sourceSessionId =
    params.sourceSessionId || (prefs as any)?.activeAgentSessionId || undefined;

  const { TelemetryService } = await import('@/lib/services/telemetry');
  let starterContext = '';

  if (params.carryContext && sourceSessionId) {
    const source = await TelemetryService.loadSession(user.$id, sourceSessionId);
    let history: Array<{ role?: string; content?: string }> = [];
    try {
      history = JSON.parse(source?.chatHistory || '[]');
    } catch {
      history = [];
    }
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey && ((source?.context || '').trim() || history.length > 0)) {
      try {
        starterContext = await compressSessionContext({
          apiKey,
          oldContext: source?.context || '',
          history: history.slice(-20)});
      } catch (err) {
        console.warn('[startNewAgentSessionFromPrompt] compress failed:', err);
        starterContext = (source?.context || '').trim();
      }
    } else {
      starterContext = (source?.context || '').trim();
    }
  }

  const newSessionId = await TelemetryService.saveSession(
    user.$id,
    starterContext,
    '[]',
    false);
  await account.updatePrefs({ ...prefs, activeAgentSessionId: newSessionId }).catch(() => {});

  return {
    success: true as const,
    sessionId: newSessionId,
    starterPrompt: starter,
    carriedContext: Boolean(starterContext)};
}

export async function recordAgentSessionObjectAction(params: {
  sessionId: string;
  objectId: string;
  objectType: string;
  title?: string | null;
  toolKey?: string | null;
}, jwt?: string) {
  const user = await requireUser(jwt);
  if (!params.sessionId || !params.objectId || !params.objectType) {
    return { success: false };
  }
  const { TelemetryService } = await import('@/lib/services/telemetry');
  await TelemetryService.recordSessionObject({
    userId: user.$id,
    sessionId: params.sessionId,
    objectId: params.objectId,
    objectType: params.objectType,
    title: params.title,
    toolKey: params.toolKey});
  return { success: true };
}

export async function recordAgentToolCallAction(params: {
  sessionId: string;
  conversationId: string;
  toolKey: string;
  specifier?: string | null;
  args?: Record<string, unknown> | null;
  status?: string | null;
  resultSummary?: string | null;
}, jwt?: string) {
  const user = await requireUser(jwt);
  if (!params.sessionId || !params.conversationId || !params.toolKey) {
    return { success: false };
  }
  const { TelemetryService } = await import('@/lib/services/telemetry');
  const id = await TelemetryService.recordToolCall({
    userId: user.$id,
    sessionId: params.sessionId,
    conversationId: params.conversationId,
    toolKey: params.toolKey,
    specifier: params.specifier,
    args: params.args || null,
    status: params.status || 'success',
    resultSummary: params.resultSummary});
  return { success: Boolean(id), id };
}

export async function listAgentToolCallsAction(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  if (!sessionId) return [];
  const { TelemetryService } = await import('@/lib/services/telemetry');
  return TelemetryService.listToolCalls(user.$id, sessionId, 120);
}

export async function listAgentSessions(jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const res = await tables.listRows({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    queries: [
      Query.equal('userId', user.$id),
      Query.notEqual('isMemory', true),
      Query.orderDesc('$createdAt'),
      Query.limit(100)
    ]
  });
  return res.rows.map((row: any) => ({
    id: row.$id,
    userId: row.userId || user.$id,
    context: row.context || '',
    chatHistory: row.chatHistory || '[]',
    isPublic: row.isPublic === true,
    isGuest: row.isGuest === true,
    isPinned: row.isPinned === true,
    targetType: row.targetType || null,
    targetId: row.targetId || null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt
  }));
}

export async function toggleAgentSessionShareAction(
  sessionId: string,
  mode: 'publish' | 'make_private',
  jwt?: string) {
  const { toggleResourcePublicGuestSecure } = await import('@/lib/actions/secure-ops/misc');
  return toggleResourcePublicGuestSecure({
    resourceType: 'agent_session',
    resourceId: sessionId,
    mode,
    jwt});
}

export async function setAgentSessionPinnedAction(
  sessionId: string,
  pinned: boolean,
  jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();

  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId});
  if (row.userId !== user.$id) throw new Error('Unauthorized');

  await tables.updateRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId,
    data: { isPinned: pinned }});

  return { success: true, isPinned: pinned };
}

export async function toggleAgentConversationShareAction(
  params: {
    sessionId: string;
    messageId: string;
    mode: 'publish' | 'make_private';
  },
  jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();

  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: params.sessionId});
  if (row.userId !== user.$id) throw new Error('Unauthorized');

  let historyArr: any[] = [];
  try {
    historyArr = JSON.parse(row.chatHistory || '[]');
  } catch {
    historyArr = [];
  }

  const enable = params.mode === 'publish';
  let found = false;
  const next = historyArr.map((m: any) => {
    if (m.id !== params.messageId) return m;
    found = true;
    return {
      ...m,
      isPublic: enable,
      isGuest: enable};
  });
  if (!found) throw new Error('Message not found in session');

  await tables.updateRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: params.sessionId,
    data: {
      chatHistory: JSON.stringify(next),
      isPublic: row.isPublic,
      isGuest: row.isGuest}});

  const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
  return {
    success: true,
    isPublic: enable,
    isGuest: enable,
    publicUrl: buildPublicResourceUrl(
      'agent_conversation',
      `${params.sessionId}__${params.messageId}`)};
}

function sanitizePublicChatMessage(m: any) {
  return {
    id: String(m?.id || ''),
    role: m?.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: String(m?.content || ''),
    isPublic: m?.isPublic === true,
    isGuest: m?.isGuest === true};
}

function parseSessionChatHistory(raw: unknown): any[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getPublicAgentSessionSecure(sessionId: string) {
  if (!sessionId) return null;
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const row = await tables
    .getRow({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      rowId: sessionId})
    .catch(() => null);

  if (!row || row.isMemory === true) return null;
  const isPublic = row.isPublic === true;
  const isGuest = row.isGuest === true;
  if (!isPublic && !isGuest) return null;

  const history = parseSessionChatHistory(row.chatHistory).map(sanitizePublicChatMessage);
  const firstUser = history.find((m) => m.role === 'user');
  const title = firstUser?.content
    ? String(firstUser.content).slice(0, 96)
    : 'Shared chat with Kylie';

  return JSON.parse(
    JSON.stringify({
      id: row.$id,
      title,
      messages: history,
      userId: row.userId || null,
      isPublic,
      isGuest,
      updatedAt: row.$updatedAt,
      createdAt: row.$createdAt}));
}

/**
 * Public read for a single shared message.
 * Composite id: `{sessionId}__{messageId}` (matches share URL builder).
 */
export async function getPublicAgentConversationSecure(compositeId: string) {
  if (!compositeId || !compositeId.includes('__')) return null;
  const sep = compositeId.indexOf('__');
  const sessionId = compositeId.slice(0, sep);
  const messageId = compositeId.slice(sep + 2);
  if (!sessionId || !messageId) return null;

  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const row = await tables
    .getRow({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      rowId: sessionId})
    .catch(() => null);

  if (!row || row.isMemory === true) return null;

  const sessionPublic = row.isPublic === true || row.isGuest === true;
  const history = parseSessionChatHistory(row.chatHistory);
  const message = history.find((m: any) => m?.id === messageId);
  if (!message) return null;

  const messagePublic = message.isPublic === true || message.isGuest === true;
  if (!sessionPublic && !messagePublic) return null;

  return JSON.parse(
    JSON.stringify({
      sessionId,
      message: sanitizePublicChatMessage(message),
      userId: row.userId || null,
      sessionIsPublic: sessionPublic,
      updatedAt: row.$updatedAt}));
}

export async function deleteAgentSession(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  
  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });
  if (row.userId !== user.$id) {
    throw new Error('Unauthorized');
  }

  // Cascade delete tool calls for this session
  try {
    const toolRows = await tables.listRows({
      databaseId: 'passwordManagerDb',
      tableId: 'tool_calls',
      queries: [Query.equal('sessionId', sessionId), Query.limit(500)]});
    for (const tr of toolRows.rows || []) {
      await tables.deleteRow({
        databaseId: 'passwordManagerDb',
        tableId: 'tool_calls',
        rowId: tr.$id}).catch(() => {});
    }
  } catch (e) {
    console.warn('[deleteAgentSession] tool_calls cascade failed:', e);
  }

  await tables.deleteRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });

  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  if ((prefs as any)?.activeAgentSessionId === sessionId) {
    const listRes = await tables.listRows({
      databaseId: 'passwordManagerDb',
      tableId: 'agentic_sessions',
      queries: [
        Query.equal('userId', user.$id),
        Query.notEqual('isMemory', true),
        Query.limit(1)
      ]
    });
    const nextSessionId = listRes.rows[0]?.$id || null;
    await account.updatePrefs({ ...prefs, activeAgentSessionId: nextSessionId }).catch(() => {});
  }

  return { success: true };
}

export async function selectAgentSession(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  
  const row = await tables.getRow({
    databaseId: 'passwordManagerDb',
    tableId: 'agentic_sessions',
    rowId: sessionId
  });
  if (row.userId !== user.$id) {
    throw new Error('Unauthorized');
  }

  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  await account.updatePrefs({ ...prefs, activeAgentSessionId: sessionId }).catch(() => {});

  return {
    success: true,
    session: {
      id: row.$id,
      context: row.context || '',
      chatHistory: row.chatHistory || '[]',
      isPublic: row.isPublic === true,
      isGuest: row.isGuest === true,
      isPinned: row.isPinned === true,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt
    }
  };
}

/** Flag a single conversation turn for quality review (not the whole session). */
export async function flagAgentConversationPointAction(
  params: {
    conversationId: string;
    messageRole: 'user' | 'assistant';
    sessionId?: string;
    reason?: string;
  },
  jwt?: string) {
  const user = await requireUser(jwt);
  if (!params.conversationId) return { success: false };

  let sessionId = params.sessionId;
  if (!sessionId) {
    const session = await getAgentSession(jwt);
    sessionId = session.rowId || undefined;
  }

  const { TelemetryService } = await import('@/lib/services/telemetry');
  await TelemetryService.recordAgenticTelemetry({
    userId: user.$id,
    action: 'conversation_flagged',
    zone: 'intelligence',
    pointers: sessionId ? `${sessionId}:${params.conversationId}` : params.conversationId,
    metadata: {
      sessionId: sessionId || null,
      conversationId: params.conversationId,
      messageRole: params.messageRole,
      reason: params.reason || 'user_retry',
      flaggedAt: new Date().toISOString()}});

  return { success: true };
}
