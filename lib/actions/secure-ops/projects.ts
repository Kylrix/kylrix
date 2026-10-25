'use server';

import * as shared from './shared';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  ProjectSchema
} from '@/lib/validations/schemas';
import { filterRootWorkspaceProjects } from '@/lib/projects/sub-projects';
import { ulid } from '@/lib/utils/ulid';
import { DEFAULT_FEEDBACK_FORM_ID, DEFAULT_FEEDBACK_FORM_ROW } from '@/constants/forms';

const {
  getActor,
} = shared;

export async function getPublicFormDataSecure(formId: string) {
  let row: any = null;

  const isDefaultFeedbackForm = formId === DEFAULT_FEEDBACK_FORM_ID || (process.env.NEXT_PUBLIC_FEEDBACK_FORM_ID && formId === process.env.NEXT_PUBLIC_FEEDBACK_FORM_ID);
  if (isDefaultFeedbackForm) {
    row = { ...DEFAULT_FEEDBACK_FORM_ROW, $id: formId, id: formId };
    return JSON.parse(JSON.stringify(row));
  }

  try {
    const tursoRows = await db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.id, formId))
      .limit(1);

    if (tursoRows.length > 0) {
      const tr = tursoRows[0];
      row = {
        $id: tr.id,
        id: tr.id,
        userId: tr.userId,
        status: tr.status || 'published',
        title: tr.title,
        description: tr.description,
        schema: tr.schema,
        settings: tr.settings,
        isPublic: Boolean(tr.isPublic),
        isGuest: Boolean(tr.isGuest),
        $createdAt: tr.createdAt,
        $updatedAt: tr.updatedAt,
      };
    }
  } catch {}

  if (!row) return null;

  return JSON.parse(JSON.stringify({
    $id: row.$id,
    id: row.$id,
    userId: row.userId,
    status: row.status,
    title: row.title,
    description: row.description,
    schema: row.schema,
    settings: typeof row.settings === 'string' ? row.settings : JSON.stringify(row.settings || {}),
    isPublic: row.isPublic,
    isGuest: row.isGuest,
    $createdAt: row.$createdAt,
    $updatedAt: row.$updatedAt,
  }));
}

export async function submitPublicFormDataSecure(input: {
  formId: string;
  payload: string;
  submitterId?: string | null;
  status?: string;
  metadata?: string | null;
}) {
  const formId = String(input?.formId || '').trim();
  if (!formId) throw new Error('formId is required');

  const submissionId = `sub_${ulid()}`;
  const nowIso = new Date().toISOString();

  await db.insert(schema.formSubmissions).values({
    id: submissionId,
    formId,
    submitterId: input.submitterId || null,
    payload: input.payload || '{}',
    status: input.status || 'unread',
    metadata: input.metadata || null,
    isPublic: true,
    isGuest: true,
    isTrash: false,
    createdAt: nowIso,
  }).onConflictDoNothing();

  return {
    $id: submissionId,
    id: submissionId,
    formId,
    submitterId: input.submitterId || null,
    payload: input.payload,
    status: input.status || 'unread',
    metadata: input.metadata,
    $createdAt: nowIso,
  };
}

export async function getPublicGoalDataSecure(goalId: string, _jwt?: string) {
  const { getGoalTurso } = await import('@/lib/actions/turso-ops');
  const tursoRes = await getGoalTurso(goalId);
  if (tursoRes.success && tursoRes.row) {
    const tr = tursoRes.row;
    return JSON.parse(
      JSON.stringify({
        id: tr.id,
        title: tr.title || 'Untitled goal',
        description: tr.description || null,
        status: tr.status || 'todo',
        priority: tr.priority || 'medium',
        dueDate: tr.dueDate || null,
        userId: tr.userId || null,
        isPublic: true,
        isGuest: true,
        updatedAt: tr.updatedAt,
      })
    );
  }
  return null;
}

export async function createAccountEventSecure(params: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return { success: true, count: 1, rows: [] };
}

export async function listProjectsWithCollaborationsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const { listWorkspacesTurso } = await import('@/lib/actions/turso-ops');
  const res = await listWorkspacesTurso(actor.$id);

  const projects = (res.rows || []).map((p: any) => ({
    ...p,
    $id: p.id,
    collabStatus: 'owner',
    isPending: false,
  }));

  return filterRootWorkspaceProjects(projects);
}

export async function createProjectSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const payloadToValidate = {
    ...data,
    title: data?.title || data?.name || 'Workspace',
  };
  const validated = ProjectSchema.parse(payloadToValidate);
  const now = new Date().toISOString();
  const projectId = data?.$id || data?.id || ulid();

  const { upsertProjectTurso } = await import('@/lib/actions/turso-ops');
  await upsertProjectTurso({
    id: projectId,
    creatorId: actor.$id,
    name: validated.title,
    title: validated.title,
    description: validated.summary || validated.description || '',
    inviteCode: validated.inviteCode || ulid(),
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: projectId, id: projectId, creatorId: actor.$id, name: validated.title, title: validated.title, createdAt: now, updatedAt: now }));
}

export async function updateProjectSecure(projectId: string, data: any, _permissions?: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { upsertProjectTurso } = await import('@/lib/actions/turso-ops');
  const now = new Date().toISOString();

  await upsertProjectTurso({
    id: projectId,
    creatorId: actor.$id,
    name: data.title || data.name || 'Workspace',
    description: data.summary || data.description || '',
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: projectId, id: projectId, creatorId: actor.$id, updatedAt: now, ...data }));
}

export async function deleteProjectSecure(
  projectId: string,
  _deleteMode: 'detach' | 'created_within' | 'all' = 'detach',
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { deleteWorkspaceTurso } = await import('@/lib/actions/turso-ops');
  await deleteWorkspaceTurso(projectId);

  return { success: true, id: projectId, isTrash: true };
}

export async function requestProjectAccessSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }
  return { success: true, status: 'requested' };
}

export async function acceptProjectInviteSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }
  return { success: true };
}

export async function addObjectToProjectSecure(
  projectId: string,
  entityKind: string,
  entityId: string,
  role?: string,
  _metadata?: any,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { upsertWorkspaceObjectTurso } = await import('@/lib/actions/turso-ops');
  const id = ulid();
  const now = new Date().toISOString();

  await upsertWorkspaceObjectTurso({
    id,
    workspaceId: projectId,
    entityKind,
    entityId,
    userId: actor.$id,
    createdAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: id, id, workspaceId: projectId, entityKind, entityId }));
}

export async function listProjectTaggedResourcesSecure(
  _projectId: string,
  _tagIds: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
}

export async function getSweptConfigSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return { userId: actor.$id, projectId, enabled: false };
}

export async function upsertSweptConfigSecure(
  projectId: string,
  patch: any,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');
  return { userId: actor.$id, projectId, enabled: Boolean(patch.enabled) };
}

export async function removeObjectFromProjectSecure(objectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  await db.delete(schema.projectObjects).where(eq(schema.projectObjects.id, objectId));
  return { success: true };
}

export async function createFormSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertFormTurso } = await import('@/lib/actions/turso-ops');
  const id = ulid();
  const now = new Date().toISOString();

  await upsertFormTurso({
    id,
    userId: actor.$id,
    title: data.title || 'Untitled Form',
    description: data.description || '',
    schema: JSON.stringify(data.schema || []),
    settings: JSON.stringify(data.settings || {}),
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: id, id, userId: actor.$id, ...data }));
}

export async function listUserFormsSecure(userId?: string, jwt?: string) {
  const actor = await getActor(jwt);
  const targetId = userId || actor?.$id;
  if (!targetId) return { rows: [], total: 0 };

  const { listFormsTurso } = await import('@/lib/actions/turso-ops');
  const res = await listFormsTurso(targetId);
  return { rows: res.rows || [], total: (res.rows || []).length };
}

export async function updateFormSecure(formId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertFormTurso } = await import('@/lib/actions/turso-ops');
  const now = new Date().toISOString();

  await upsertFormTurso({
    id: formId,
    userId: actor.$id,
    title: data.title || 'Untitled Form',
    description: data.description || '',
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: formId, id: formId, ...data }));
}

export async function deleteFormSecure(formId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  await db.delete(schema.forms).where(eq(schema.forms.id, formId));
  return { $id: formId, success: true };
}

export async function createEventSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertEventTurso } = await import('@/lib/actions/turso-ops');
  const id = ulid();
  const now = new Date().toISOString();

  await upsertEventTurso({
    id,
    userId: actor.$id,
    title: data.title || 'Event',
    startTime: data.startTime || now,
    endTime: data.endTime || now,
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: id, id, ...data }));
}

export async function updateEventSecure(eventId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertEventTurso } = await import('@/lib/actions/turso-ops');
  const now = new Date().toISOString();

  await upsertEventTurso({
    id: eventId,
    userId: actor.$id,
    title: data.title || 'Event',
    startTime: data.startTime || now,
    endTime: data.endTime || now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: eventId, id: eventId, ...data }));
}

export async function deleteEventSecure(eventId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  await db.delete(schema.events).where(eq(schema.events.id, eventId));
  return { success: true };
}

export async function addEventManagerSecure(_eventId: string, _targetUserId: string, _permissionLevel: string = 'viewer', _jwt?: string) {
  return { success: true };
}

export async function removeEventManagerSecure(_eventId: string, _targetUserId: string, _jwt?: string) {
  return { success: true };
}

export async function convertResponseToGoalSecure(submissionId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertGoalTurso } = await import('@/lib/actions/turso-ops');
  const id = ulid();
  await upsertGoalTurso({
    id,
    userId: actor.$id,
    title: `Action: Form Response ${submissionId.slice(-8)}`,
    description: '',
  });

  return { $id: id, id, title: `Action: Form Response ${submissionId.slice(-8)}` };
}

export async function initGoalDiscussionSecure(taskId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { ThreadService } = await import('@/lib/services/threads');
  const { thread, created } = await ThreadService.getOrCreate({
    parentKind: 'goal',
    parentId: taskId,
    channel: ThreadService.CHANNEL_DISCUSS,
    ownerId: actor.$id,
    title: `Goal discussion: ${taskId}`,
  });

  return { discussionId: thread.id, threadId: thread.id, created };
}

export async function approveProjectJoinRequestSecure(_projectId: string, _targetUserId: string, _permissionLevel: 'admin' | 'editor' | 'viewer' = 'viewer', _jwt?: string) {
  return { success: true };
}

export async function createGoalSecure(data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertGoalTurso } = await import('@/lib/actions/turso-ops');
  const id = data?.$id || data?.id || ulid();

  await upsertGoalTurso({
    id,
    userId: actor.$id,
    title: data.title || 'Untitled Goal',
    description: data.description || '',
    status: data.status || 'todo',
    priority: data.priority || 'medium',
  });

  return { $id: id, id, userId: actor.$id, ...data };
}

export async function updateGoalSecure(goalId: string, data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertGoalTurso } = await import('@/lib/actions/turso-ops');
  await upsertGoalTurso({
    id: goalId,
    userId: actor.$id,
    title: data.title || 'Untitled Goal',
    description: data.description || '',
    status: data.status || 'todo',
    priority: data.priority || 'medium',
  });

  return { $id: goalId, id: goalId, userId: actor.$id, ...data };
}

export async function deleteGoalSecure(goalId: string, jwt?: string): Promise<void> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { deleteGoalTurso } = await import('@/lib/actions/turso-ops');
  await deleteGoalTurso(goalId);
}

export async function resolveWorkspaceShareAccessSecure(workspaceId: string, jwt?: string) {
  const actor = await getActor(jwt).catch(() => null);
  const { getWorkspaceTurso } = await import('@/lib/actions/turso-ops');
  const res = await getWorkspaceTurso(workspaceId);

  if (!res.success || !res.workspace) {
    return { success: false, reason: 'not_found' as const, message: 'Workspace does not exist.' };
  }

  const row = res.workspace;
  return {
    success: true,
    workspace: {
      id: row.id,
      title: row.name,
      ownerId: row.creatorId,
      isPublic: Boolean(row.isPublic),
      isAgentic: Boolean(row.isAgentic),
      isOwner: actor?.$id === row.creatorId,
    },
  };
}

export async function rotateWorkspaceInviteCodeSecure(workspaceId: string, jwt?: string, explicitCode?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const newCode = explicitCode || ulid();
  await db
    .update(schema.projects)
    .set({ inviteCode: newCode, updatedAt: new Date().toISOString() })
    .where(eq(schema.projects.id, workspaceId));

  return { success: true, inviteCode: newCode, projectId: workspaceId };
}

export async function joinWorkspaceByInviteCodeSecure(workspaceId: string, _inviteCode: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { getWorkspaceTurso } = await import('@/lib/actions/turso-ops');
  const res = await getWorkspaceTurso(workspaceId);

  return {
    success: true,
    workspace: {
      id: workspaceId,
      title: res.workspace?.name || 'Workspace',
      ownerId: res.workspace?.creatorId || actor.$id,
      isPublic: true,
      isAgentic: false,
      role: 'editor',
    },
  };
}

export async function getSharedWorkspaceEntitiesSecure(
  workspaceId: string,
  _entityKind: string,
  jwt?: string,
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  return { success: true, rows: [] };
}

export async function resolveAgentKeyBlobSecure(
  agentOrWorkspaceId: string,
  _jwt?: string
) {
  return { success: true, agentId: agentOrWorkspaceId, encryptedKeyBlob: null, mekHex: null };
}
