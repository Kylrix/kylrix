import type { ApiActor } from '@/lib/api/guard';
import type { SystemTablesPort } from '@/lib/data';

const CHAT_DB = 'chat';
const PROJECT_OBJECTS = 'project_objects';

export class WorkspaceJailError extends Error {
  status = 403;
  code = 'workspace_jailed';

  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceJailError';
  }
}

/**
 * Returns the jailed workspace ID if the actor is constrained to a workspace.
 */
export function getJailedWorkspaceId(actor: ApiActor): string | null {
  if (actor.category === 'workspace_pat' && actor.workspaceId) {
    return actor.workspaceId;
  }
  if (actor.workspaceId && typeof actor.workspaceId === 'string' && actor.workspaceId.trim().length > 0) {
    return actor.workspaceId.trim();
  }
  return null;
}

/**
 * Returns true if the actor is jailed to a concrete workspace.
 */
export function isWorkspaceJailed(actor: ApiActor): boolean {
  return Boolean(getJailedWorkspaceId(actor));
}

/**
 * Strictly enforces workspace boundary jailing for an actor.
 */
export function enforceWorkspaceJailing(
  actor: ApiActor,
  requestedWorkspaceId?: string | null,
): string | null {
  const jailedWs = getJailedWorkspaceId(actor);
  if (jailedWs) {
    if (requestedWorkspaceId && requestedWorkspaceId !== jailedWs) {
      throw new WorkspaceJailError(
        `Actor is strictly jailed to workspace '${jailedWs}'. Access to workspace '${requestedWorkspaceId}' is forbidden.`
      );
    }
    return jailedWs;
  }
  return requestedWorkspaceId || null;
}

/**
 * Asserts that an object belongs to the jailed workspace.
 */
export async function assertObjectInWorkspace(
  tables: SystemTablesPort,
  actor: ApiActor,
  _entityKind: string,
  entityId: string,
  row?: any,
): Promise<void> {
  const jailedWs = getJailedWorkspaceId(actor);
  if (!jailedWs) return;

  // 1. Direct row property checks
  if (row) {
    if (row.projectId === jailedWs || row.workspaceId === jailedWs) {
      return;
    }
    if (row.metadata) {
      try {
        const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        if (meta?.projectId === jailedWs || meta?.workspaceId === jailedWs) {
          return;
        }
      } catch {}
    }
    if (Array.isArray(row.tags)) {
      if (
        row.tags.some(
          (t: unknown) =>
            typeof t === 'string' &&
            (t === `workspace:${jailedWs}` ||
              t === `project:${jailedWs}` ||
              t === `ws:${jailedWs}`),
        )
      ) {
        return;
      }
    }
  }

  // 2. Query project_objects join table
  try {
    const res = await tables.listRows({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      queries: [
        { type: 'equal', attribute: 'projectId', value: jailedWs },
        { type: 'equal', attribute: 'entityId', value: entityId },
        { type: 'limit', value: 1 },
      ],
    }).catch(() => ({ rows: [] as any[] }));

    if (res.rows && res.rows.length > 0) {
      return;
    }
  } catch {}

  throw new WorkspaceJailError(
    `Access denied. Object '${entityId}' does not belong to jailed workspace '${jailedWs}'.`
  );
}
