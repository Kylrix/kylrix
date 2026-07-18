'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ID, Query } from 'node-appwrite';

import { createSystemClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';

type AgentStatus = 'idle' | 'working';

export interface AgentRecord {
  $id: string;
  ownerId: string;
  parentId?: string | null;
  publicKey?: string | null;
  config?: string;
  status?: string;
  $updatedAt?: string;
}

interface AgentConfig {
  name?: string;
  goal?: string | null;
  framework?: string;
  lastRunAt?: string;
  lastSummary?: string | null;
  lastError?: string | null;
}

function parseAgentConfig(raw?: string): AgentConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as AgentConfig;
  } catch {
    return {};
  }
}

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
    throw new Error('AI features require a Pro account. Upgrade to continue.');
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

async function getOwnedAgentOrThrow(agentId: string, ownerId: string) {
  const { databases } = createSystemClient();
  const id = String(agentId || '').trim();
  if (!id) throw new Error('agentId is required');

  const agent = (await databases.getRow(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    id,
  )) as unknown as AgentRecord;
  if (!agent) throw new Error('Agent not found.');
  if (agent.ownerId !== ownerId) throw new Error('Forbidden');
  return agent;
}

export async function listMyAgents(jwt?: string): Promise<AgentRecord[]> {
  const user = await requireUser(jwt);
  const { databases } = createSystemClient();
  const res = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    [Query.equal('ownerId', user.$id), Query.orderDesc('$updatedAt'), Query.limit(100)],
  );
  return (res.rows || []) as unknown as AgentRecord[];
}

export async function createMyAgent(input: {
  name: string;
  goal?: string;
  framework?: 'kylrix' | 'openclaw' | 'hermes';
}, jwt?: string) {
  const user = await requireUser(jwt);
  
  const name = String(input.name || '').trim();
  if (!name) throw new Error('name is required');

  const framework = input.framework === 'openclaw' || input.framework === 'hermes' ? input.framework : 'kylrix';
  const { databases } = createSystemClient();
  await databases.createRow(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    ID.unique(),
    {
      ownerId: user.$id,
      parentId: null,
      publicKey: `pending:${Date.now().toString(36)}`,
      status: 'idle',
      config: JSON.stringify({
        name,
        goal: input.goal?.trim() || null,
        framework,
      }),
    },
  );
}

export async function setMyAgentStatus(agentId: string, status: AgentStatus, jwt?: string) {
  const user = await requireUser(jwt);
  const id = String(agentId || '').trim();
  if (!id) throw new Error('agentId is required');

  await getOwnedAgentOrThrow(id, user.$id);
  const { databases } = createSystemClient();
  await databases.updateRow(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    id,
    { status },
  );
}

export async function runMyAgent(agentId: string, jwt?: string): Promise<{ summary: string }> {
  const user = await requireUser(jwt);
  const id = String(agentId || '').trim();
  if (!id) throw new Error('agentId is required');

  const agent = await getOwnedAgentOrThrow(id, user.$id);
  const config = parseAgentConfig(agent.config);
  const { databases } = createSystemClient();

  await databases.updateRow(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    agentId,
    { status: 'working' },
  );

  try {
    const balanceRow = await checkComputeBalance(user.$id);

    const tasksRes = await databases.listRows(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      [Query.equal('userId', user.$id), Query.orderDesc('$updatedAt'), Query.limit(20)],
    );

    const tasks = (tasksRes.rows || []).map((t: any) => ({
      id: t.$id,
      title: t.title || 'Untitled',
      status: t.status || 'todo',
      priority: t.priority || 'medium',
      dueDate: t.dueDate || null,
    }));

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini is not configured on this deployment.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
      systemInstruction:
        'You are a Kylrix internal autonomous agent. Return concise operational guidance only.',
    });

    const prompt = [
      `Agent name: ${config.name || `Agent ${agent.$id.slice(0, 6)}`}`,
      `Goal: ${config.goal || 'General productivity assistance.'}`,
      'Generate a short execution summary and next actions based on current tasks.',
      `Tasks JSON: ${JSON.stringify(tasks)}`].join('\n');

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim().slice(0, 6000);

    await debitComputeBalance(user.$id, balanceRow, prompt, summary);

    const nextConfig: AgentConfig = {
      ...config,
      lastRunAt: new Date().toISOString(),
      lastSummary: summary,
      lastError: null,
    };

    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      agentId,
      {
        status: 'idle',
        config: JSON.stringify(nextConfig),
      },
    );

    return { summary };
  } catch (error) {
    const nextConfig: AgentConfig = {
      ...config,
      lastRunAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : 'Agent run failed.',
    };

    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      agentId,
      {
        status: 'idle',
        config: JSON.stringify(nextConfig),
      },
    );
    throw error;
  }
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
  },
): Promise<{
  success: boolean;
  response: string;
  toolCalls?: any[];
  nextSteps?: Array<{ label: string; prompt: string }>;
  sessionId?: string;
  conversationId?: string;
}> {
  const user = await requireUser(jwt);
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini is not configured on this deployment.');
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
      activeSessionId = `session_${Date.now()}`;
      await TelemetryService.saveSession(user.$id, '', '[]', false, activeSessionId);
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
      // Only append the last 15 chats for context to avoid overloading the model
      const tail = historyArr.slice(-15);
      recentMessagesStr = tail.map((m: any) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n');
    } catch {}

    if (activeSessionId) {
      const sessionObjects = await TelemetryService.listSessionObjects(user.$id, activeSessionId, 40);
      if (sessionObjects.length > 0) {
        sessionObjectsSnippet = sessionObjects
          .map(
            (o) =>
              `- type=${o.objectType} id=${o.objectId} title="${(o.title || '').replace(/"/g, "'")}" tool=${o.toolKey || 'n/a'}`,
          )
          .join('\n');
      }
    }
  }

  // Load dynamic ecosystem database information and telemetry background for contextual reasoning
  let telemetrySnippet = "No recent behavior patterns logged.";
  let userResourceSummaries = "No active resources loaded.";

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
    const [notesRes, tasksRes, projectsRes] = await Promise.all([
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
        Query.limit(5),
      ]),
    ]).catch(() => [
      { rows: [], total: 0 },
      { rows: [], total: 0 },
      { rows: [], total: 0 },
    ]);

    const recentIdeaTitles = (notesRes.rows || [])
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
  const userMsgText = String(meta?.userMessage || "").trim();
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

  // Redact potentially sensitive details (passwords, PINs, auth keys) in prompt
  const redactedPrompt = prompt
    .replace(/(password|pass|pin|secret|key|private)\s*[:=]\s*[^\s]+/gi, '$1: [REDACTED]')
    .replace(/(?<=^|\s)[A-Za-z0-9+/]{40,}(?=$|\s)/g, '[REDACTED_HASH]');

  // Inject ecosystem data structures / RLS guidelines, explicitly redacting or dropping security models
  const { NOTE_TOOL_PAYLOAD_SCHEMA } = await import('@/lib/agentic/tools-registry');
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

[NOTE / IDEA TOOL JSON CONTRACT — EXACT]
${NOTE_TOOL_PAYLOAD_SCHEMA}

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

  const { AGENTIC_TOOLS_REGISTRY } = await import('@/lib/agentic/tools-registry');
  const toolsSnippet = AGENTIC_TOOLS_REGISTRY.map(t => 
    `- Key: "${t.key}" (${t.name}): ${t.description}. Params: ${t.parameters.join(', ')}`
  ).join('\n');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
    systemInstruction: [
      'You are Kylie — the friendly Kylrix workspace partner embedded in the user workspace. Speak as Kylie in first person when natural; never call yourself System or Smart System.',
      'Identity (when asked who you are / what you do): say you are Kylie, their productivity sidekick. Keep it short and warm.',
      'Steering: if the ask is vague, offer 2–3 concrete next steps tied to the current page. If off-topic, gently redirect to Ideas, Flow, Vault, Connect, or Projects. If unsafe or impossible here, say so plainly and suggest what they can do instead.',
      'NEXT STEPS: After substantive help, include suggest_next_steps with clickable prompts grounded in recent idea titles, habits, and this chat. Prefer at least one create_goal-oriented chip. Goals matter on every page.',
      'Respond with concise, actionable output. Prefer bullet steps when planning.',
      'Stay grounded in the current page context and Kylrix apps: Ideas, Flow, Vault, Connect, Projects.',
      'MUTATION PROTOCOL (STRICT):',
      '- Workspace mutations ONLY happen through toolCalls. Prose never creates data.',
      '- If the user asks to compose, write, draft, create, or save an Idea/note: toolCalls MUST include create_note with title + content. The response field may describe what you are creating, but MUST NOT claim it already exists unless create_note is present in toolCalls.',
      '- If the user asks to edit an existing Idea: toolCalls MUST include update_note with specifier = note $id from [SESSION OBJECTS] or prior context.',
      '- If the user asks to open/show an Idea by id: toolCalls MUST include get_note with that specifier.',
      '- When Kylie creates a goal: create_goal with isAgentic true.',
      '- Empty toolCalls is only valid for pure Q&A with no create/update/navigate side effects.',
      '- NEVER tell the user to create the Idea manually when create_note can do it.',
      'You MUST return a valid JSON object matching this schema exactly:',
      '{',
      '  "response": "Visible reply to the user (markdown). Required.",',
      '  "sessionContextUpdate": "Optional facts to append to session context.",',
      '  "lifetimeMemoryUpdate": "Optional high-quality lifelong memory. Leave blank if none.",',
      '  "toolCalls": [',
      '     {',
      '        "toolKey": "create_note | update_note | get_note | create_goal | update_goal | create_project | link_to_project | suggest_next_steps | toggle_privacy | navigate_workspace | delete_resource",',
      '        "specifier": "note/goal/project id or route when required; null otherwise",',
      '        "subSpecifier": "optional field name",',
      '        "args": { "title": "...", "content": "...", "tags": [], "isPublic": false, "isAgentic": true, "suggestions": [{ "label": "...", "prompt": "..." }], "objectType": "note", "objectId": "...", "type": "note" }',
      '     }',
      '  ]',
      '}',
      'Example — user asks to compose an Idea titled Odyssey:',
      '{"response":"Creating Idea \\"odyssey, the movie\\" with a concise Greek-mythology write-up.","toolCalls":[{"toolKey":"create_note","specifier":null,"args":{"title":"odyssey, the movie","content":"## Odyssey\\nConcise Greek mythology write-up...","tags":[],"isPublic":false}},{"toolKey":"suggest_next_steps","args":{"suggestions":[{"label":"Create a goal for Odyssey","prompt":"Create a high-priority goal titled \\"Ship Odyssey outline\\" with isAgentic true using create_goal."},{"label":"Connect Odyssey to a project","prompt":"If a matching project exists, link the Odyssey idea to it with link_to_project; otherwise create a project titled Odyssey and link the idea."}]}}]}',
      '[AVAILABLE TOOLS]',
      toolsSnippet,
      DATA_STRUCTURES_GUIDE,
      contextBlock || 'No page context supplied.',
      sessionBlock,
      memoryBlock,
      hintContext,
    ].join('\n'),
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const response = await model.generateContent(redactedPrompt);
  const responseTextRaw = response.response.text().trim();

  let visibleResponse = responseTextRaw;
  let sessionUpdate = "";
  let memoryUpdate = "";
  let isThreadCompletedVal: number | undefined = undefined;
  let parsedToolCalls: any[] | undefined = undefined;
  let parsedNextSteps: Array<{ label: string; prompt: string }> | undefined = undefined;

  try {
    const parsed = JSON.parse(responseTextRaw);
    visibleResponse = parsed.response || responseTextRaw;
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
    // Fallback if AI output doesn't match JSON structure perfectly
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
      prompt: String(item?.prompt || '').trim(),
    }))
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
    options?.userMessage || pageContext?.userMessage,
  );
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
        ...(nextStepsForHistory.length ? { nextSteps: nextStepsForHistory } : {}),
      });

      let nextContext = sessionContext;
      if (sessionUpdate) {
        nextContext = nextContext ? `${nextContext}\n- ${sessionUpdate}` : `- ${sessionUpdate}`;
      }

      // Compact behind-the-hood session context only — never wipe live chatHistory.
      if (historyArr.length >= 6) {
        try {
          const compactModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: 'You are the context compactor engine. Merge the old context with the new user interactions, keeping only crucial rules, parameters, outcomes, and progress details. Output clean compressed text.'
          });
          const compactable = historyArr.slice(-6).map((m: any) => {
            const body = typeof m.content === 'string' ? m.content : '';
            return `${m.role === 'user' ? 'User' : 'Agent'}: ${body}`;
          }).join('\n');
          const compactorPrompt = `
Old Context:
${nextContext}

New Chats Added:
${compactable}
`;
          const compactRes = await compactModel.generateContent(compactorPrompt);
          nextContext = compactRes.response.text().trim();
        } catch (compactErr) {
          console.warn('[executeInstantRequestAction] Context compact failed:', compactErr);
        }
      }

      await TelemetryService.saveSession(
        user.$id,
        nextContext,
        JSON.stringify(historyArr),
        false,
        sessionData?.rowId || activeSessionId,
      );

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
    conversationId,
  };
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
      const newSessionId = `session_${Date.now()}`;
      await TelemetryService.saveSession(user.$id, '', '[]', false, newSessionId);
      activeSessionId = newSessionId;
      await account.updatePrefs({ ...prefs, activeAgentSessionId: activeSessionId }).catch(() => {});
      session = { context: '', chatHistory: '[]', seen: false, rowId: newSessionId };
    }
  }

  return session;
}

export async function startNewAgentSession(jwt?: string) {
  const user = await requireUser(jwt);
  const { account } = await createServerClient(jwt);
  const prefs = await account.getPrefs().catch(() => ({}));
  
  const newSessionId = `session_${Date.now()}`;
  const { TelemetryService } = await import('@/lib/services/telemetry');
  await TelemetryService.saveSession(user.$id, '', '[]', false, newSessionId);
  
  await account.updatePrefs({ ...prefs, activeAgentSessionId: newSessionId }).catch(() => {});
  return { success: true, sessionId: newSessionId };
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
    toolKey: params.toolKey,
  });
  return { success: true };
}

export async function listAgentSessionObjectsAction(sessionId: string, jwt?: string) {
  const user = await requireUser(jwt);
  if (!sessionId) return [];
  const { TelemetryService } = await import('@/lib/services/telemetry');
  return TelemetryService.listSessionObjects(user.$id, sessionId, 40);
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
    resultSummary: params.resultSummary,
  });
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
    context: row.context || '',
    chatHistory: row.chatHistory || '[]',
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt
  }));
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
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt
    }
  };
}
