import { ID, Permission, Query, Role, type Models } from 'appwrite';

import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';
export type AgentStatus = 'idle' | 'working';

export interface AgentRecord extends Models.Row {
  ownerId: string;
  parentId?: string | null;
  publicKey?: string | null;
  config?: string;
  status?: string;
}

function agentPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export const AgenticService = {
  async listMyAgents(userId: string): Promise<AgentRecord[]> {
    const res = await tablesDB.listRows<AgentRecord>({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      queries: [Query.equal('ownerId', userId), Query.orderDesc('$updatedAt'), Query.limit(100)],
    });

    return res.rows ?? [];
  },

  async createMyAgent(input: {
    userId: string;
    name: string;
    goal?: string;
    framework?: AgentFramework;
  }) {
    const framework = input.framework === 'openclaw' || input.framework === 'hermes' ? input.framework : 'kylrix';
    return await tablesDB.createRow(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      ID.unique(),
      {
        ownerId: input.userId,
        parentId: null,
        publicKey: `pending:${Date.now().toString(36)}`,
        status: 'idle',
        config: JSON.stringify({
          name: input.name.trim(),
          goal: input.goal?.trim() || null,
          framework,
        }),
      },
      agentPermissions(input.userId),
    );
  },

  async setMyAgentStatus(userId: string, agentId: string, status: AgentStatus) {
    const agent = await tablesDB.getRow<AgentRecord>(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      agentId,
    );
    if (!agent || agent.ownerId !== userId) {
      throw new Error('Forbidden');
    }

    return await tablesDB.updateRow(
      APPWRITE_CONFIG.DATABASES.FLOW,
      APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
      agentId,
      { status },
    );
  },
};
