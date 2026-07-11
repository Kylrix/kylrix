import { tablesDB, getCurrentUser } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getEcosystemUrl } from '../constants';
import { ID, Query, Permission, Role } from 'appwrite';
import { Forms, FormSubmissions, ActivityLogCreate, FormSubmissionsStatus, FormsStatus, ActivityLog } from '../../generated/appwrite/types';
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
        if (typeof window !== 'undefined') {
            const { createForm } = await import('@/lib/actions/client-ops');
            return await createForm(data);
        }
        const { createFormSecure } = await import('@/lib/actions/secure-ops');
        return await createFormSecure(data);
    },

    /**
     * Get a form by ID (Public Access Support)
     */
    async getForm(formId: string) {
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
        return await tablesDB.listRows<Forms>({
            databaseId: DATABASE_ID,
            tableId: FORMS_TABLE,
            queries: [
                Query.equal('userId', userId),
                Query.notEqual('isTrash', true),
                Query.orderDesc('$createdAt'),
                Query.limit(50),
                Query.select(['$id', 'userId', 'status', 'settings', 'title', 'description', 'schema', 'isPublic', 'isGuest', '$createdAt'])
            ]
        });
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
        if (typeof window !== 'undefined') {
            const { updateForm } = await import('@/lib/actions/client-ops');
            return await updateForm(formId, data);
        }
        const { updateFormSecure } = await import('@/lib/actions/secure-ops');
        return await updateFormSecure(formId, data);
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
                Query.select(['$id', 'userId', 'status', 'settings', 'title', 'description', 'schema', 'isPublic', 'isGuest', '$createdAt'])
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
            submission = await tablesDB.createRow<FormSubmissions>(
                DATABASE_ID,
                SUBMISSIONS_TABLE,
                ID.unique(),
                {
                    formId,
                    submitterId: submitterId || null,
                    payload,
                    status: FormSubmissionsStatus.UNREAD,
                    metadata: JSON.stringify({
                        submittedAt: new Date().toISOString(),
                    })
                },
                submissionPermissions
            );
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
                        submissionId: submission.$id,
                    },
                });
            } catch (e) {
                console.error('[Forms] Failed to queue submission email', e);
            }
        }

        return submission;
    },

    /**
     * Delete a form
     */
    async deleteForm(formId: string) {
        if (typeof window !== 'undefined') {
            const { deleteForm } = await import('@/lib/actions/client-ops');
            return await deleteForm(formId);
        }
        const { deleteFormSecure } = await import('@/lib/actions/secure-ops');
        return await deleteFormSecure(formId);
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
    }
};
