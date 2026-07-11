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
  },
): Promise<{ success: boolean; response: string }> {
  const user = await requireUser(jwt);
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini is not configured on this deployment.');
  }

  const balanceRow = await checkComputeBalance(user.$id);
  const { databases } = createSystemClient();

  // Load dynamic ecosystem database information and telemetry background for contextual reasoning
  let telemetrySnippet = "No recent behavior patterns logged.";
  let userResourceSummaries = "No active resources loaded.";

  try {
    // 1. Fetch recent activity for anonymized pattern matches
    const recentActivity = await databases.listRows(
      'passwordManagerDb',
      'app_activity_logs',
      [Query.equal('userId', user.$id), Query.orderDesc('$createdAt'), Query.limit(8)]
    );
    if (recentActivity.rows.length > 0) {
      telemetrySnippet = recentActivity.rows.map((r: any) => `- Action: ${r.action} in Niche: ${r.niche} (${r.$createdAt})`).join('\n');
    }

    // 2. Fetch basic structural context for Notes/Goals/Projects to allow AI to know about active records
    const [notesRes, tasksRes, projectsRes] = await Promise.all([
      databases.listRows('passwordManagerDb', '67ff05f3002502ef239e', [Query.equal('userId', user.$id), Query.notEqual('isTrash', true), Query.limit(5)]),
      databases.listRows('passwordManagerDb', 'tasks', [Query.equal('userId', user.$id), Query.notEqual('isTrash', true), Query.limit(5)]),
      databases.listRows('passwordManagerDb', 'projects', [Query.equal('ownerId', user.$id), Query.notEqual('isTrash', true), Query.limit(5)])
    ]).catch(() => [[], [], []]);

    const activeNotes = (notesRes.rows || []).map((n: any) => `- Note ID: ${n.$id}, Title: "${n.title}"`).join('\n');
    const activeTasks = (tasksRes.rows || []).map((t: any) => `- Goal/Task ID: ${t.$id}, Title: "${t.title}" (Status: ${t.status})`).join('\n');
    const activeProjects = (projectsRes.rows || []).map((p: any) => `- Project ID: ${p.$id}, Title: "${p.title}"`).join('\n');

    userResourceSummaries = `
Active Notes:
${activeNotes || "None"}
Active Goals/Tasks:
${activeTasks || "None"}
Active Projects:
${activeProjects || "None"}
`;
  } catch (err) {
    console.error('[executeInstantRequestAction] Failed to retrieve context details:', err);
  }

  // Inject ecosystem data structures / RLS guidelines
  const DATA_STRUCTURES_GUIDE = `
[KYLRIX DATA ECOSYSTEM STRUCTURES & SCHEMAS]
1. Database Consolidation: All tables live in database: "passwordManagerDb".
2. Tables available:
   - "67ff05f3002502ef239e" (Notes): fields { userId, title, content, isTrash, isPublic, isGuest }
   - "67ff06280034908cf08a" (Tags): fields { userId, name, color, isTrash }
   - "tasks" (Goals / Tasks): fields { userId, title, status, priority, isTrash }
   - "events" (Calendar events): fields { userId, title, startTime, endTime, isTrash }
   - "forms" (Dynamic Forms): fields { userId, title, schema, settings, isTrash }
   - "formSubmissions" (Responses): fields { submitterId, formId, status, payload, isTrash }
   - "credentials" (Secrets): fields { userId, name, login, password, url, isTrash }
   - "totpSecrets" (TOTP tokens): fields { userId, issuer, secret, isTrash }
   - "projects" (Shared work spaces): fields { ownerId, title, summary, isTrash }

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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
    systemInstruction: [
      'You are the Kylrix Smart System assistant embedded in the user workspace.',
      'Respond with concise, actionable output. Prefer bullet steps when planning.',
      'Stay grounded in the current page context and Kylrix apps: Ideas, Flow, Vault, Connect, Projects.',
      DATA_STRUCTURES_GUIDE,
      contextBlock || 'No page context supplied.',
    ].join('\n'),
  });

  const response = await model.generateContent(prompt);
  const responseText = response.response.text().trim();

  await debitComputeBalance(user.$id, balanceRow, prompt, responseText);

  // Log this interaction to telemetry
  try {
    const { TelemetryService } = await import('./telemetry');
    await TelemetryService.recordTelemetry({
      niche: 'intelligence',
      app: 'agentic',
      action: 'instant_request',
      intent: pageContext?.zone || 'workspace',
      metadata: {
        promptLength: prompt.length,
        responseLength: responseText.length,
        pageContext: pageContext || null
      }
    });
  } catch (err) {
    console.error('Failed to log instant request telemetry:', err);
  }

  return {
    success: true,
    response: responseText
  };
}
