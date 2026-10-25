import { ulid } from '@/lib/utils/ulid';
import { getEcosystemUrl } from '../constants';
import { sendKylrixEmailNotification } from '../email-notifications';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const FormsService = {
  async createForm(userId: string, data: any) {
    let createdForm: any = null;
    try {
      const { unifiedCreate } = await import('@/lib/services/unified-object-service');
      const row = await unifiedCreate('form', data as Record<string, any>, { ownerId: userId });
      if ((row as any)?.$id || (row as any)?.id) createdForm = row;
    } catch {}

    if (!createdForm) {
      if (typeof window !== 'undefined') {
        const { createForm } = await import('@/lib/actions/client-ops');
        createdForm = await createForm(data);
      } else {
        const { createFormSecure } = await import('@/lib/actions/secure-ops');
        createdForm = await createFormSecure(data);
      }
    }

    if (typeof window !== 'undefined' && (createdForm?.$id || createdForm?.id)) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cacheKeys = [`f_forms_list_${userId}`, `f_forms_${userId}`, 'f_forms_list'];
        for (const key of cacheKeys) {
          const existing = (await LocalEngine.cacheGet<any[]>(key)) || [];
          const updated = [createdForm, ...existing.filter((f: any) => (f.$id || f.id) !== (createdForm.$id || createdForm.id))];
          await LocalEngine.cacheSet(key, updated);
        }
      } catch {}
    }

    return createdForm;
  },

  async getForm(formId: string) {
    const isDefaultFeedback = formId === '6aae3dab003a7247b90a' || (process.env.NEXT_PUBLIC_FEEDBACK_FORM_ID && formId === process.env.NEXT_PUBLIC_FEEDBACK_FORM_ID);
    if (isDefaultFeedback) {
      const { DEFAULT_FEEDBACK_FORM_ROW } = await import('@/constants/forms');
      return DEFAULT_FEEDBACK_FORM_ROW as any;
    }

    if (typeof window !== 'undefined') {
      const { getPublicFormData } = await import('@/lib/actions/client-ops');
      const doc = await getPublicFormData(formId).catch(() => null);
      if (doc) return doc as any;
    } else {
      const { getPublicFormDataSecure } = await import('@/lib/actions/secure-ops');
      const doc = await getPublicFormDataSecure(formId).catch(() => null);
      if (doc) return doc as any;
    }

    try {
      const rows = await db.select().from(schema.forms).where(eq(schema.forms.id, formId)).limit(1);
      if (rows.length > 0) return { ...rows[0], $id: rows[0].id };
    } catch {}

    throw new Error(`Form [${formId}] not found or inaccessible.`);
  },

  async listUserForms(userId: string) {
    const { listFormsTurso } = await import('@/lib/actions/turso-ops');
    return await listFormsTurso(userId);
  },

  async togglePin(formId: string) {
    const form = await this.getForm(formId);
    const newPinned = !form.isPinned;
    return await this.updateForm(formId, { isPinned: newPinned } as any);
  },

  async updateForm(formId: string, data: any) {
    let updatedForm: any = null;
    if (typeof window !== 'undefined') {
      const { updateForm } = await import('@/lib/actions/client-ops');
      updatedForm = await updateForm(formId, data);
    } else {
      const { updateFormSecure } = await import('@/lib/actions/secure-ops');
      updatedForm = await updateFormSecure(formId, data);
    }

    return updatedForm;
  },

  async deleteForm(formId: string) {
    if (typeof window !== 'undefined') {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      void LocalEngine.markDeleted(formId, 'guest');

      const { deleteForm } = await import('@/lib/actions/client-ops');
      return await deleteForm(formId);
    }
    const { deleteFormSecure } = await import('@/lib/actions/secure-ops');
    return await deleteFormSecure(formId);
  },

  async submitForm(formId: string, payload: string, userId?: string) {
    const form = await FormsService.getForm(formId);

    if (form.status !== 'published' && !form.isPublic && !form.isGuest) {
      throw new Error('This form is not accepting submissions.');
    }

    const submissionId = ulid();
    const nowIso = new Date().toISOString();

    await db.insert(schema.formSubmissions).values({
      id: submissionId,
      formId,
      submitterId: userId || null,
      payload,
      status: 'unread',
      isPublic: Boolean(form.isPublic),
      isGuest: Boolean(form.isGuest),
      isTrash: false,
      createdAt: nowIso,
    });

    if (form.userId) {
      try {
        await sendKylrixEmailNotification({
          eventType: 'form_response_submitted',
          sourceApp: 'flow',
          actorName: userId || 'Anonymous',
          recipientIds: [form.userId],
          resourceId: formId,
          resourceTitle: form.title || 'Form',
          resourceType: 'form',
          templateKey: 'flow:form-response-submitted',
          ctaUrl: `${getEcosystemUrl('flow')}/form/${formId}?submissionId=${submissionId}`,
          ctaText: 'View submission detail',
          metadata: {
            submissionId,
          },
        });
      } catch (e) {
        console.error('[Forms] Failed to queue submission email', e);
      }
    }

    return { $id: submissionId, id: submissionId, formId, submitterId: userId || null, payload };
  },

  async listSubmissions(formId: string) {
    const rows = await db
      .select()
      .from(schema.formSubmissions)
      .where(and(eq(schema.formSubmissions.formId, formId), eq(schema.formSubmissions.isTrash, false)));

    return {
      rows: rows.map((row) => ({
        ...row,
        $id: row.id,
        submitterName: row.submitterId ? row.submitterId : 'Anonymous',
      })),
      total: rows.length,
    };
  },

  async updateSubmission(submissionId: string, data: any) {
    await db
      .update(schema.formSubmissions)
      .set(data)
      .where(eq(schema.formSubmissions.id, submissionId));
    return { $id: submissionId, id: submissionId, ...data };
  },

  async deleteSubmission(submissionId: string) {
    await db.delete(schema.formSubmissions).where(eq(schema.formSubmissions.id, submissionId));
    return { success: true };
  },

  async getCurrentUser() {
    const { getCurrentUser } = await import('@/lib/data');
    return getCurrentUser();
  },

  async batchTrashSubmissions(formId: string, submissionIds: string[]) {
    if (!submissionIds.length) return { success: true, count: 0 };
    if (typeof window !== 'undefined') {
      const { batchTrashFormSubmissions } = await import('@/lib/actions/client-ops');
      return await batchTrashFormSubmissions(formId, submissionIds);
    }
    const { batchTrashFormSubmissionsSecure } = await import('@/lib/actions/secure-ops/misc');
    return await batchTrashFormSubmissionsSecure(formId, submissionIds);
  },
};
