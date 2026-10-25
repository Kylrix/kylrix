import { ulid } from '@/lib/utils/ulid';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getNamedListCache } from './list-cache';

export type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';
export type AgentStatus = 'idle' | 'working';

export interface AgentRecord {
  $id: string;
  id: string;
  ownerId: string;
  parentId?: string | null;
  publicKey?: string | null;
  config?: string;
  status?: AgentStatus | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const agentsCache = getNamedListCache<AgentRecord[]>('agents', 45000);

export const AgenticService = {
  async listMyAgents(userId: string, force = false): Promise<AgentRecord[]> {
    return agentsCache.fetch(async () => {
      const rows = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.ownerId, userId))
        .orderBy(desc(schema.agents.createdAt));

      return rows.map((r) => ({
        ...r,
        $id: r.id,
      })) as AgentRecord[];
    }, force);
  },

  async createMyAgent(input: {
    userId: string;
    name: string;
    goal?: string;
    framework?: AgentFramework;
  }) {
    const framework = input.framework === 'openclaw' || input.framework === 'hermes' ? input.framework : 'kylrix';
    const agentId = ulid();
    const now = new Date().toISOString();

    const config = JSON.stringify({
      name: input.name.trim(),
      goal: input.goal?.trim() || null,
      framework,
    });

    await db.insert(schema.agents).values({
      id: agentId,
      ownerId: input.userId,
      parentId: null,
      publicKey: `pending:${Date.now().toString(36)}`,
      status: 'idle',
      config,
      createdAt: now,
      updatedAt: now,
    });

    agentsCache.invalidate();

    const res: AgentRecord = {
      $id: agentId,
      id: agentId,
      ownerId: input.userId,
      parentId: null,
      publicKey: `pending:${Date.now().toString(36)}`,
      status: 'idle',
      config,
      createdAt: now,
      updatedAt: now,
    };

    void (async () => {
      try {
        const { AgentIdentityService } = await import('./agent-identity');
        await AgentIdentityService.syncAgentProfile({
          agentId,
          ownerId: input.userId,
          name: input.name.trim(),
          goal: input.goal?.trim(),
          framework,
        });
      } catch (err) {
        console.warn('[AgenticService] Background profile sync failed:', err);
      }
    })();

    return res;
  },

  async setMyAgentStatus(userId: string, agentId: string, status: AgentStatus) {
    const now = new Date().toISOString();
    await db
      .update(schema.agents)
      .set({ status, updatedAt: now })
      .where(eq(schema.agents.id, agentId));

    agentsCache.invalidate();
    return { id: agentId, status };
  },
};
