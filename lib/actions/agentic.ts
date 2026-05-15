'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ID, Query } from 'node-appwrite';

import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

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

async function requireUser() {
  const { account } = await createServerClient();
  const user = await account.get();
  if (!user?.$id) throw new Error('Unauthorized');
  return user;
}

async function getOwnedAgentOrThrow(agentId: string, ownerId: string) {
  const { databases } = createAdminClient();
  const agent = (await databases.getDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    agentId,
  )) as unknown as AgentRecord;
  if (!agent) throw new Error('Agent not found.');
  if (agent.ownerId !== ownerId) throw new Error('Forbidden');
  return agent;
}

export async function listMyAgents(): Promise<AgentRecord[]> {
  const user = await requireUser();
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    [Query.equal('ownerId', user.$id), Query.orderDesc('$updatedAt'), Query.limit(100)],
  );
  return (res.documents || []) as unknown as AgentRecord[];
}

export async function createMyAgent(input: {
  name: string;
  goal?: string;
  framework?: 'kylrix' | 'openclaw' | 'hermes';
}) {
  const user = await requireUser();
  const framework = input.framework === 'openclaw' || input.framework === 'hermes' ? input.framework : 'kylrix';
  const { databases } = createAdminClient();
  await databases.createDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    ID.unique(),
    {
      ownerId: user.$id,
      parentId: null,
      publicKey: `pending:${Date.now().toString(36)}`,
      status: 'idle',
      config: JSON.stringify({
        name: input.name.trim(),
        goal: input.goal?.trim() || null,
        framework,
      }),
    },
  );
}

export async function setMyAgentStatus(agentId: string, status: AgentStatus) {
  const user = await requireUser();
  await getOwnedAgentOrThrow(agentId, user.$id);
  const { databases } = createAdminClient();
  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    agentId,
    { status },
  );
}

export async function runMyAgent(agentId: string): Promise<{ summary: string }> {
  const user = await requireUser();
  const agent = await getOwnedAgentOrThrow(agentId, user.$id);
  const config = parseAgentConfig(agent.config);
  const { databases } = createAdminClient();

  await databases.updateDocument(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
    agentId,
    { status: 'working' },
  );

  try {
    const tasksRes = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      [Query.equal('userId', user.$id), Query.orderDesc('$updatedAt'), Query.limit(20)],
    );

    const tasks = (tasksRes.documents || []).map((t: any) => ({
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
      `Tasks JSON: ${JSON.stringify(tasks)}`,
    ].join('\n');

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim().slice(0, 6000);

    const nextConfig: AgentConfig = {
      ...config,
      lastRunAt: new Date().toISOString(),
      lastSummary: summary,
      lastError: null,
    };

    await databases.updateDocument(
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

    await databases.updateDocument(
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
