'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ID, Query } from 'node-appwrite';

import { createSystemClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite/server';
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

import { getActor } from './secure-ops';

// ... (rest of imports)

async function requireUser(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return actor;
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
