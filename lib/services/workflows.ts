import { ID, Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { WorkflowChain } from '@/lib/workflow-engine';
import { TelemetryNiche } from '@/lib/context-engine';

const DATABASE_ID = 'whisperrflow';
const TABLE_ID = 'workflows';

export const WorkflowDbService = {
  /**
   * Persist a workflow chain in the Appwrite database.
   * If the workflow already exists, updates it.
   */
  async saveWorkflow(wf: WorkflowChain, userId?: string): Promise<string> {
    try {
      const tables = createSystemTablesDB();
      const payload = {
        workflowId: wf.id,
        name: wf.name,
        description: wf.description,
        niche: wf.niche,
        isPublic: wf.isPublic,
        isAnonymized: wf.isAnonymized,
        steps: JSON.stringify(wf.steps),
        metadata: JSON.stringify({
          originalCreatedAt: wf.createdAt,
          savedAt: new Date().toISOString()
        })
      };

      // Set user as document owner if provided
      const permissions = userId ? [
        `read("user:${userId}")`,
        `write("user:${userId}")`
      ] : undefined;

      // Check if document already exists
      const existing = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.equal('workflowId', wf.id), Query.limit(1)]
      });

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: row.$id,
          data: payload,
          permissions
        });
        return wf.id;
      } else {
        await tables.createRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: ID.unique(),
          data: payload,
          permissions
        });
        return wf.id;
      }
    } catch (err) {
      console.error('[WorkflowDbService] Failed to save workflow:', err);
      throw err;
    }
  },

  /**
   * List all user-accessible workflows (Appwrite document security filters this natively)
   */
  async listWorkflows(): Promise<WorkflowChain[]> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.orderDesc('$createdAt'), Query.limit(100)]
      });

      return res.rows.map(row => {
        let steps = [];
        try {
          steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : [];
        } catch {
          // Fallback
        }

        return {
          id: row.workflowId,
          name: row.name,
          description: row.description,
          niche: row.niche as TelemetryNiche,
          steps,
          isPublic: row.isPublic,
          isAnonymized: row.isAnonymized,
          createdAt: row.$createdAt
        };
      });
    } catch (err) {
      console.error('[WorkflowDbService] Failed to list workflows:', err);
      return [];
    }
  },

  /**
   * List all shared public workflows across the platform
   */
  async listPublicWorkflows(): Promise<WorkflowChain[]> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [
          Query.equal('isPublic', true),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      });

      return res.rows.map(row => {
        let steps = [];
        try {
          steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : [];
        } catch {
          // Fallback
        }

        return {
          id: row.workflowId,
          name: row.name,
          description: row.description,
          niche: row.niche as TelemetryNiche,
          steps,
          isPublic: row.isPublic,
          isAnonymized: row.isAnonymized,
          createdAt: row.$createdAt
        };
      });
    } catch (err) {
      console.error('[WorkflowDbService] Failed to list public workflows:', err);
      return [];
    }
  },

  /**
   * Delete a workflow by its unique ID
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const existing = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.equal('workflowId', workflowId), Query.limit(1)]
      });

      if (existing.rows.length > 0) {
        await tables.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: existing.rows[0].$id
        });
      }
    } catch (err) {
      console.error('[WorkflowDbService] Failed to delete workflow:', err);
      throw err;
    }
  }
};
