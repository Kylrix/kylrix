import { tablesDB, getCurrentUser } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getEcosystemUrl } from '../constants';
import { ID, Query, Permission, Role } from 'appwrite';
import { Forms, FormSubmissions, FormSubmissionsStatus, ActivityLog } from '../../generated/appwrite/types';
import { sendKylrixEmailNotification } from '../email-notifications';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const FORMS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
const SUBMISSIONS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS;
const ACTIVITY_LOG_TABLE = "activityLog";
const NOTE_DATABASE_ID = APPWRITE_CONFIG.NOTE_DATABASE_ID;

export const FormsService = {
    /**
     * Create a new form definition
     */
    async createForm(userId: string, data: Omit<Forms, '$id' | '$createdAt' | '$updatedAt' | '$permissions' | '$databaseId' | '$tableId' | 'userId' | '$sequence' | '$tableId'>) {
        let createdForm: Forms | null = null;
        try {
            const { unifiedCreate } = await import('@/lib/services/unified-object-service');
            const row = await unifiedCreate('form', data as Record<string, any>, { ownerId: userId });
            if ((row as any)?.$id) createdForm = row as unknown as Forms;
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

        if (typeof window !== 'undefined' && createdForm?.$id) {
            try {
                const { LocalEngine } = await import('@/lib/services/LocalEngine');
                const cacheKeys = [`f_forms_list_${userId}`, `f_forms_${userId}`, 'f_forms_list'];
                for (const key of cacheKeys) {
                    const existing = (await LocalEngine.cacheGet<any[]>(key)) || [];
                    const updated = [createdForm, ...existing.filter((f: any) => (f.$id || f.id) !== createdForm!.$id)];
                    await LocalEngine.cacheSet(key, updated);
                }
            } catch {}
        }

        return createdForm;
    },

    /**
     * Get a form by ID (Public Access Support)
     */
    async getForm(formId: string) {
        if (typeof window !== 'undefined') {
            const { getPublicFormData } = await import('@/lib/actions/client-ops');
            const doc = await getPublicFormData(formId).catch(() => null);
            if (doc) return doc as unknown as Forms;
        } else {
            const { getPublicFormDataSecure } = await import('@/lib/actions/secure-ops');
            const doc = await getPublicFormDataSecure(formId).catch(() => null);
            if (doc) return doc as unknown as Forms;
        }

        try {
            const res = await (tablesDB as any).listRows({
                databaseId: DATABASE_ID,
                tableId: FORMS_TABLE,
                queries: [
                    Query.equal('$id', formId),
                    Query.limit(1),
                    Query.select(['$id', 'userId', 'status', 'settings', 'title', 'description', 'schema', 'isPublic', 'isGuest', '$createdAt'])
                ]
            });

            if (res.total > 0) return res.rows[0];
        } catch (_e) {
            console.warn('[FormsService] Client-side getForm failed, trying secure fallback...');
        }

        // Secure Fallback: use server-side action which has its own permission engine
        const { getRowSecure } = await import('@/lib/actions/secure-ops');
        try {
            const doc = await getRowSecure(DATABASE_ID, FORMS_TABLE, formId);
            if (doc) return doc;
        } catch (secureErr) {
            console.error('[FormsService] Secure getForm fallback failed:', secureErr);
        }

        throw new Error(`Form [${formId}] not found or inaccessible.`);
    },

    /**
     * Internal: Resolve current user
     */
    async getCurrentUser() {
        return await getCurrentUser();
    },

    /**
     * List forms for a user
     */
    async listUserForms(userId: string) {
        if (typeof window !== 'undefined') {
            const { listUserForms } = await import('@/lib/actions/client-ops');
            return await listUserForms(userId);
        }
        const { listUserFormsSecure } = await import('@/lib/actions/secure-ops');
        return await listUserFormsSecure(userId);
    },

    /**
     * Update a form definition
     */
    /**
     * Update a form definition with strict permission synchronization
     */
    async togglePin(formId: string) {
        const form = await this.getForm(formId);
        const newPinned = !form.isPinned;
        return await this.updateForm(formId, { isPinned: newPinned } as any);
    },

    async updateForm(formId: string, data: Partial<Forms>) {
        let updatedForm: Forms | null = null;
        if (typeof window !== 'undefined') {
            const { updateForm } = await import('@/lib/actions/client-ops');
            updatedForm = await updateForm(formId, data);
        } else {
            const { updateFormSecure } = await import('@/lib/actions/secure-ops');
            updatedForm = await updateFormSecure(formId, data);
        }

        if (typeof window !== 'undefined' && updatedForm?.$id) {
            try {
                const { getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
                const uid = getCurrentUserSnapshot()?.$id || 'guest';
                const { LocalEngine } = await import('@/lib/services/LocalEngine');
                const cacheKeys = [`f_forms_list_${uid}`, `f_forms_${uid}`, 'f_forms_list'];
                for (const key of cacheKeys) {
                    const existing = (await LocalEngine.cacheGet<any[]>(key)) || [];
                    if (existing.length > 0) {
                        const updated = existing.map((f: any) => (f.$id === formId || f.id === formId ? { ...f, ...updatedForm } : f));
                        await LocalEngine.cacheSet(key, updated);
                    }
                }
            } catch {}
        }

        return updatedForm;
    },

    async deleteForm(formId: string) {
        if (typeof window !== 'undefined') {
            const { getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
            const uid = getCurrentUserSnapshot()?.$id || 'guest';
            const { LocalEngine } = await import('@/lib/services/LocalEngine');
            void LocalEngine.markDeleted(formId, uid);

            try {
                const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
                const db = await getRxDB();
                if (db?.forms) {
                    const doc = await db.forms.findOne(formId).exec().catch(() => null);
                    if (doc) await doc.remove().catch(() => {});
                }
            } catch {}

            try {
                const cacheKeys = [`f_forms_list_${uid}`, `f_forms_${uid}`, 'f_forms_list'];
                for (const key of cacheKeys) {
                    const existing = (await LocalEngine.cacheGet<any[]>(key)) || [];
                    if (existing.length > 0) {
                        const updated = existing.filter((f: any) => (f.$id || f.id) !== formId);
                        await LocalEngine.cacheSet(key, updated);
                    }
                }
            } catch {}

            const { deleteForm } = await import('@/lib/actions/client-ops');
            return await deleteForm(formId);
        }
        const { deleteFormSecure } = await import('@/lib/actions/secure-ops');
        return await deleteFormSecure(formId);
    },

    /**
     * Get a draft if it exists for a user and form
     */
    async getDraft(formId: string, userId: string) {
        const res = await tablesDB.listRows<FormSubmissions>({
            databaseId: DATABASE_ID,
            tableId: SUBMISSIONS_TABLE,
            queries: [
                Query.equal('formId', formId),
                Query.equal('submitterId', userId),
                Query.limit(20),
                Query.select(['$id', 'formId', 'submitterId', 'status', 'metadata', 'payload', '$createdAt'])
            ]
        });

        return res.rows.find(s => {
            try {
                if (!s.metadata) return false;
                const meta = JSON.parse(s.metadata);
                return meta.isDraft === true;
            } catch (_e) { return false; }
        });
    },

    /**
     * Save a draft response (Authenticated users only)
     */
    async saveDraft(formId: string, payload: string, userId: string) {
        // Check for existing draft (fetch all and find in memory because metadata is encrypted and not queryable)
        const res = await tablesDB.listRows<FormSubmissions>({
            databaseId: DATABASE_ID,
            tableId: SUBMISSIONS_TABLE,
            queries: [
                Query.equal('formId', formId),
                Query.equal('submitterId', userId),
                Query.limit(20),
                Query.select(['$id', 'formId', 'submitterId', 'status', 'metadata', 'payload', '$createdAt'])
            ]
        });

        const existingDraft = res.rows.find(s => {
            try {
                if (!s.metadata) return false;
                const meta = JSON.parse(s.metadata);
                return meta.isDraft === true;
            } catch (_e) { return false; }
        });

        const submissionPermissions = [
            Permission.read(Role.user(userId))];

        if (existingDraft) {
            return await tablesDB.updateRow<FormSubmissions>(
                DATABASE_ID,
                SUBMISSIONS_TABLE,
                existingDraft.$id,
                {
                    payload,
                    metadata: JSON.stringify({
                        isDraft: true,
                        updatedAt: new Date().toISOString()
                    })
                }
            );
        }

        return await tablesDB.createRow<FormSubmissions>(
            DATABASE_ID,
            SUBMISSIONS_TABLE,
            ID.unique(),
            {
                formId,
                submitterId: userId,
                payload,
                status: FormSubmissionsStatus.UNREAD,
                metadata: JSON.stringify({
                    isDraft: true,
                    updatedAt: new Date().toISOString()
                })
            },
            submissionPermissions
        );
    },

    /**
     * Submit form data
     */
    async submitForm(formId: string, payload: string, userId?: string) {
        // Use listRows to bypass potential SDK-level getRow restrictions for anonymous users
        const formRes = await tablesDB.listRows<Forms>({
            databaseId: DATABASE_ID,
            tableId: FORMS_TABLE,
            queries: [
                Query.equal('$id', formId),
                Query.limit(1),
                Query.select(['$id', 'userId', 'status', 'settings', 'title', 'description', 'schema', 'isPublic', 'isGuest', 'isMultiple', '$createdAt'])
            ]
        });

        if (formRes.total === 0) {
            throw new Error('Form configuration not found.');
        }

        const form = formRes.rows[0];
        
        if (form.status !== 'published') {
            throw new Error('This form is not accepting submissions.');
        }

        // Check expiry
        let settings: any = {};
        try {
            settings = JSON.parse(form.settings || '{}');
        } catch (_e) {}

        if (settings.expiresAt) {
            const expiry = new Date(settings.expiresAt);
            if (expiry < new Date()) {
                throw new Error('This form has expired and is no longer accepting responses.');
            }
        }

        // Check anonymous fill using new paradigm, fallback to settings
        const allowAnonymousFill = form.isGuest ?? settings.allowAnonymousFill ?? false;
        
        let submitterId = userId;
        let submitterLabel = 'Anonymous';
        if (!submitterId) {
            const currentUser = await getCurrentUser();
            if (currentUser?.$id) {
                submitterId = currentUser.$id;
                submitterLabel = currentUser.name || currentUser.email || currentUser.$id;
            }
        } else {
            submitterLabel = submitterId;
        }

        if (!submitterId && !allowAnonymousFill) {
            throw new Error('Authentication required to submit this form.');
        }

        // Submissions Table permissions:
        // 1. Owner can READ/UPDATE/DELETE
        const submissionPermissions = [
            Permission.read(Role.user(form.userId))];

        // 2. If user is logged in, allow THEM to read their own submission later
        if (submitterId) {
            submissionPermissions.push(Permission.read(Role.user(submitterId)));
        }

        const isMultiple = Boolean((form as any).isMultiple);

        // CHECK FOR EXISTING DRAFT TO CONVERT
        let submission;
        if (submitterId) {
            const res = await tablesDB.listRows<FormSubmissions>({
                databaseId: DATABASE_ID,
                tableId: SUBMISSIONS_TABLE,
                queries: [
                    Query.equal('formId', formId),
                    Query.equal('submitterId', submitterId),
                    Query.limit(20),
                    Query.select(['$id', 'formId', 'submitterId', 'status', 'metadata', '$createdAt'])
                ]
            });

            const existingDraft = res.rows.find(s => {
                try {
                    if (!s.metadata) return false;
                    const meta = JSON.parse(s.metadata);
                    return meta.isDraft === true;
                } catch (_e) { return false; }
            });

            if (existingDraft) {
                submission = await tablesDB.updateRow<FormSubmissions>(
                    DATABASE_ID,
                    SUBMISSIONS_TABLE,
                    existingDraft.$id,
                    {
                        payload,
                        metadata: JSON.stringify({
                            submittedAt: new Date().toISOString(),
                            wasDraft: true
                        })
                    }
                );
            }
        }

        if (!submission) {
            if (submitterId) {
                if (!isMultiple) {
                    // Single submission per user: exact formId_submitterId key
                    const rowId = deriveSubmissionRowId(formId, submitterId, 1);
                    try {
                        submission = await tablesDB.createRow<FormSubmissions>(
                            DATABASE_ID,
                            SUBMISSIONS_TABLE,
                            rowId,
                            {
                                formId,
                                submitterId: submitterId || null,
                                payload,
                                status: FormSubmissionsStatus.UNREAD,
                                metadata: JSON.stringify({
                                    submittedAt: new Date().toISOString()
                                })
                            },
                            submissionPermissions
                        );
                    } catch (err: any) {
                        const isConflict =
                            err?.code === 409 ||
                            String(err?.message || '').includes('already exists') ||
                            err?.type === 'document_already_exists' ||
                            err?.type === 'row_already_exists';
                        if (isConflict) {
                            throw new Error('You have already submitted a response to this form.');
                        }
                        throw err;
                    }
                } else {
                    // Multiple submissions enabled: retry {formId}_{submitterId}, {formId}_{submitterId}_2, etc.
                    let created = null;
                    for (let attempt = 1; attempt <= 20; attempt++) {
                        const rowId = deriveSubmissionRowId(formId, submitterId, attempt);
                        try {
                            created = await tablesDB.createRow<FormSubmissions>(
                                DATABASE_ID,
                                SUBMISSIONS_TABLE,
                                rowId,
                                {
                                    formId,
                                    submitterId: submitterId || null,
                                    payload,
                                    status: FormSubmissionsStatus.UNREAD,
                                    metadata: JSON.stringify({
                                        submittedAt: new Date().toISOString(),
                                        submissionIndex: attempt,
                                    })
                                },
                                submissionPermissions
                            );
                            break;
                        } catch (err: any) {
                            const isConflict =
                                err?.code === 409 ||
                                String(err?.message || '').includes('already exists') ||
                                err?.type === 'document_already_exists' ||
                                err?.type === 'row_already_exists';
                            if (!isConflict) {
                                throw err;
                            }
                        }
                    }
                    if (!created) {
                        created = await tablesDB.createRow<FormSubmissions>(
                            DATABASE_ID,
                            SUBMISSIONS_TABLE,
                            ID.unique(),
                            {
                                formId,
                                submitterId: submitterId || null,
                                payload,
                                status: FormSubmissionsStatus.UNREAD,
                                metadata: JSON.stringify({
                                    submittedAt: new Date().toISOString()
                                })
                            },
                            submissionPermissions
                        );
                    }
                    submission = created;
                }
            } else {
                // Anonymous guest submission
                submission = await tablesDB.createRow<FormSubmissions>(
                    DATABASE_ID,
                    SUBMISSIONS_TABLE,
                    ID.unique(),
                    {
                        formId,
                        submitterId: null,
                        payload,
                        status: FormSubmissionsStatus.UNREAD,
                        metadata: JSON.stringify({
                            submittedAt: new Date().toISOString()
                        })
                    },
                    submissionPermissions
                );
            }
        }
        // Notify form owner via ActivityLog
        try {
            await tablesDB.createRow<ActivityLog>(
                NOTE_DATABASE_ID,
                ACTIVITY_LOG_TABLE,
                ID.unique(),
                {
                    userId: form.userId,
                    action: `New submission received for form: ${form.title}`,
                    targetType: 'form',
                    targetId: formId,
                    timestamp: new Date().toISOString(),
                    details: JSON.stringify({
                        read: false,
                        submissionId: submission.$id,
                        formTitle: form.title
                    })
                }
            );
        } catch (e) {
            console.error('Failed to create notification activity log', e);
        }

        if (form.userId) {
            try {
                await sendKylrixEmailNotification({
                    eventType: 'form_response_submitted',
                    sourceApp: 'flow',
                    actorName: submitterLabel,
                    recipientIds: [form.userId],
                    resourceId: formId,
                    resourceTitle: form.title || 'Form',
                    resourceType: 'form',
                    templateKey: 'flow:form-response-submitted',
                    ctaUrl: `${getEcosystemUrl('flow')}/forms/${formId}`,
                    ctaText: 'Review submission',
                    metadata: {
                        submissionId: submission.$id}});
            } catch (e) {
                console.error('[Forms] Failed to queue submission email', e);
            }
        }

        // Execute default automated response action: convert response to workspace goal
        try {
            if (settings.autoGoalAction !== false) {
                if (typeof window !== 'undefined') {
                    const { convertResponseToGoal } = await import('@/lib/actions/client-ops');
                    void convertResponseToGoal(submission.$id).catch(() => {});
                } else {
                    const { convertResponseToGoalSecure } = await import('@/lib/actions/secure-ops/projects');
                    void convertResponseToGoalSecure(submission.$id).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[Forms] Auto goal action execution failed', e);
        }

        return submission;
    },


    /**
     * Add a collaborator to a form
     */
    async addCollaborator(formId: string, userId: string, role: string = 'viewer') {
        if (typeof window !== 'undefined') {
            const { addFormCollaborator } = await import('@/lib/actions/client-ops');
            return await addFormCollaborator(formId, userId, role);
        }
        const { addFormCollaboratorSecure } = await import('@/lib/actions/secure-ops');
        return await addFormCollaboratorSecure(formId, userId, role);
    },

    /**
     * Remove a collaborator from a form
     */
    async removeCollaborator(formId: string, userId: string) {
        if (typeof window !== 'undefined') {
            const { removeFormCollaborator } = await import('@/lib/actions/client-ops');
            return await removeFormCollaborator(formId, userId);
        }
        const { removeFormCollaboratorSecure } = await import('@/lib/actions/secure-ops');
        return await removeFormCollaboratorSecure(formId, userId);
    },

    /**
     * List submissions for a specific form with submitter enrichment
     */
    async listSubmissions(formId: string) {
        const res = await tablesDB.listRows<FormSubmissions>({
            databaseId: DATABASE_ID,
            tableId: SUBMISSIONS_TABLE,
            queries: [
                Query.equal('formId', formId),
                Query.notEqual('isTrash', true),
                Query.orderDesc('$createdAt')
            ]
        });

        // Enrich with usernames from Chat database if submitterId exists
        const submitterIds = Array.from(new Set(res.rows.map(r => r.submitterId).filter(Boolean))) as string[];
        
        if (submitterIds.length > 0) {
            try {
                const userRes = await tablesDB.listRows<any>({
                    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                    tableId: 'users', 
                    queries: [Query.equal('$id', submitterIds)] 
                });
                
                // Map of userId -> username
                const userMap = new Map(userRes.rows.map((u: any) => [u.$id, u.username || u.displayName || u.$id]));
                
                return {
                    ...res,
                    rows: res.rows.map(row => ({
                        ...row,
                        submitterName: row.submitterId ? (userMap.get(row.submitterId) || row.submitterId) : 'Anonymous'
                    }))
                };
            } catch (e) {
                console.error('[Forms] Failed to enrich submitter names', e);
            }
        }

        return {
            ...res,
            rows: res.rows.map(row => ({
                ...row,
                submitterName: row.submitterId ? row.submitterId : 'Anonymous'
            }))
        };
    },

    /**
     * Update submission metadata (e.g., read status)
     */
    async updateSubmission(submissionId: string, data: Partial<FormSubmissions>) {
        return await tablesDB.updateRow<FormSubmissions>(
            DATABASE_ID,
            SUBMISSIONS_TABLE,
            submissionId,
            data
        );
    },

    /**
     * Delete a submission (permanent or soft)
     */
    async deleteSubmission(submissionId: string) {
        return await tablesDB.deleteRow(
            DATABASE_ID,
            SUBMISSIONS_TABLE,
            submissionId
        );
    },

    /**
     * Batch soft-delete / trash submissions for a form
     */
    async batchTrashSubmissions(formId: string, submissionIds: string[]) {
        if (!submissionIds.length) return { success: true, count: 0 };
        if (typeof window !== 'undefined') {
            const { batchTrashFormSubmissions } = await import('@/lib/actions/client-ops');
            return await batchTrashFormSubmissions(formId, submissionIds);
        }
        const { batchTrashFormSubmissionsSecure } = await import('@/lib/actions/secure-ops/misc');
        return await batchTrashFormSubmissionsSecure(formId, submissionIds);
    }
};

export function deriveSubmissionRowId(formId: string, submitterId: string, attempt: number = 1): string {
    const cleanForm = String(formId || '').replace(/[^a-zA-Z0-9]/g, '');
    const cleanSub = String(submitterId || '').replace(/[^a-zA-Z0-9]/g, '');
    if (attempt <= 1) {
        const fPart = cleanForm.slice(0, 17);
        const sPart = cleanSub.slice(0, 17);
        return `${fPart}_${sPart}`.slice(0, 36);
    }
    const suffix = `_${attempt}`;
    const maxLen = 36 - suffix.length;
    const half = Math.floor((maxLen - 1) / 2);
    return `${cleanForm.slice(0, half)}_${cleanSub.slice(0, half)}${suffix}`;
}
