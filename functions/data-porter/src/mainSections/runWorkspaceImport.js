import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';


export function runWorkspaceImport(bag: any) {
  const {
  runWorkspaceImport
  } = bag as any;

    const summary = {
        vaultFolders: { created: 0, reused: 0, errors: 0 },
        vaultCredentials: { created: 0, reused: 0, errors: 0 },
        vaultTotpSecrets: { created: 0, reused: 0, errors: 0 },
        tags: { created: 0, reused: 0, errors: 0 },
        notes: { created: 0, reused: 0, errors: 0 },
        forms: { created: 0, reused: 0, errors: 0 },
        tasks: { created: 0, reused: 0, errors: 0 },
        events: { created: 0, reused: 0, errors: 0 },
    };
    const errors = [];

    const workspaceData = payload.data || {};

    // 1. IMPORT VAULT FOLDERS
    const folderIdMapping = new Map();
    const foldersToImport = workspaceData.vault?.folders || [];
    log(`Importing ${foldersToImport.length} vault folders...`);

    const existingVaultFolders = new Map();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, FOLDERS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                if (doc.name) existingVaultFolders.set(doc.name.trim().toLowerCase(), doc.$id);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing folders: ${e.message}`);
    }

    for (const folder of foldersToImport) {
        try {
            const folderName = (folder.name || '').trim();
            if (!folderName) continue;

            const nameKey = folderName.toLowerCase();
            if (existingVaultFolders.has(nameKey)) {
                const existingId = existingVaultFolders.get(nameKey);
                folderIdMapping.set(folder.id, existingId);
                summary.vaultFolders.reused++;
                continue;
            }

            const clean = {
                userId,
                name: folderName,
                parentFolderId: folder.parentFolderId || null,
                icon: folder.icon || null,
                color: folder.color || null,
                sortOrder: folder.sortOrder || 0,
                isDeleted: folder.isDeleted || false,
                createdAt: folder.createdAt || new Date().toISOString(),
                updatedAt: folder.updatedAt || new Date().toISOString()
            };

            const created = await databases.createDocument(
                VAULT_DB, FOLDERS_TABLE, ID.unique(), clean,
                [Permission.read(Role.user(userId))]
            );
            folderIdMapping.set(folder.id, created.$id);
            existingVaultFolders.set(nameKey, created.$id);
            summary.vaultFolders.created++;
        } catch (e) {
            summary.vaultFolders.errors++;
            errors.push(`Vault Folder "${folder.name}": ${e.message}`);
        }
    }

    // 2. IMPORT VAULT CREDENTIALS
    const credsToImport = workspaceData.vault?.credentials || [];
    log(`Importing ${credsToImport.length} vault credentials...`);

    const existingCreds = new Set();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, CREDENTIALS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const c of res.documents) {
                const key = `${normalizeUrl(c.url)}|${(c.username || '').trim()}|${(c.password || '').trim()}`;
                existingCreds.add(key);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing credentials: ${e.message}`);
    }

    for (let i = 0; i < credsToImport.length; i += BATCH_SIZE) {
        const batch = credsToImport.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(cred => {
                const key = `${normalizeUrl(cred.url)}|${(cred.username || '').trim()}|${(cred.password || '').trim()}`;
                if (existingCreds.has(key)) {
                    return Promise.reject(new Error('DUPLICATE'));
                }
                existingCreds.add(key);

                const cleaned = cleanCredential(cred, folderIdMapping, userId);
                return databases.createDocument(
                    VAULT_DB, CREDENTIALS_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                summary.vaultCredentials.created++;
            } else {
                if (res.reason?.message === 'DUPLICATE') {
                    summary.vaultCredentials.reused++;
                } else {
                    summary.vaultCredentials.errors++;
                    errors.push(`Vault Credential "${batch[index]?.name || 'Unknown'}": ${res.reason?.message || 'Unknown error'}`);
                }
            }
        });

        if (i + BATCH_SIZE < credsToImport.length) await sleep(BATCH_DELAY_MS);
    }

    // 3. IMPORT VAULT TOTPs
    const totpsToImport = workspaceData.vault?.totpSecrets || [];
    log(`Importing ${totpsToImport.length} vault TOTPs...`);

    const existingTotps = new Set();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, TOTP_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const t of res.documents) {
                if (t.secretKey) existingTotps.add(t.secretKey.trim());
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing TOTPs: ${e.message}`);
    }

    for (let i = 0; i < totpsToImport.length; i += BATCH_SIZE) {
        const batch = totpsToImport.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(totp => {
                const key = (totp.secretKey || '').trim();
                if (key && existingTotps.has(key)) {
                    return Promise.reject(new Error('DUPLICATE'));
                }
                if (key) existingTotps.add(key);

                const cleaned = {
                    userId,
                    issuer: totp.issuer,
                    accountName: totp.accountName,
                    secretKey: totp.secretKey,
                    algorithm: totp.algorithm || 'SHA1',
                    digits: totp.digits || 6,
                    period: totp.period || 30,
                    folderId: totp.folderId && folderIdMapping.has(totp.folderId) ? folderIdMapping.get(totp.folderId) : null,
                    url: totp.url || null,
                    tags: totp.tags || null,
                    isFavorite: totp.isFavorite || false,
                    isDeleted: totp.isDeleted || false,
                    createdAt: totp.createdAt || new Date().toISOString(),
                    updatedAt: totp.updatedAt || new Date().toISOString()
                };

                return databases.createDocument(
                    VAULT_DB, TOTP_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                summary.vaultTotpSecrets.created++;
            } else {
                if (res.reason?.message === 'DUPLICATE') {
                    summary.vaultTotpSecrets.reused++;
                } else {
                    summary.vaultTotpSecrets.errors++;
                    errors.push(`Vault TOTP "${batch[index]?.issuer || 'Unknown'}": ${res.reason?.message || 'Unknown error'}`);
                }
            }
        });

        if (i + BATCH_SIZE < totpsToImport.length) await sleep(BATCH_DELAY_MS);
    }

    // 4. IMPORT NOTE TAGS
    const tagsToImport = workspaceData.notes?.tags || [];
    log(`Importing ${tagsToImport.length} note tags...`);

    const tagIdMapping = new Map();
    const existingTags = new Map();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(NOTE_DB, TAGS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                if (doc.nameLower) existingTags.set(doc.nameLower, doc.$id);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing tags: ${e.message}`);
    }

    for (const tag of tagsToImport) {
        try {
            const name = (tag.name || '').trim();
            if (!name) continue;

            const nameLower = name.toLowerCase();
            if (existingTags.has(nameLower)) {
                const existingId = existingTags.get(nameLower);
                tagIdMapping.set(tag.id, existingId);
                summary.tags.reused++;
                continue;
            }

            const clean = {
                userId,
                name,
                nameLower,
                metadata: tag.metadata || null,
                isPublic: tag.isPublic || false,
                isGuest: tag.isGuest || false,
                usageCount: tag.usageCount || 0
            };

            const created = await databases.createDocument(
                NOTE_DB, TAGS_TABLE, ID.unique(), clean,
                [Permission.read(Role.user(userId))]
            );
            tagIdMapping.set(tag.id, created.$id);
            existingTags.set(nameLower, created.$id);
            summary.tags.created++;
        } catch (e) {
            summary.tags.errors++;
            errors.push(`Note Tag "${tag.name}": ${e.message}`);
        }
    }

    // 5. IMPORT NOTES
    const notesToImport = workspaceData.notes?.rows || [];
    log(`Importing ${notesToImport.length} notes...`);

    const noteIdMapping = new Map();
    const existingNotes = new Set();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(NOTE_DB, NOTES_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                const key = `${(doc.title || '').trim()}|${(doc.content || '').trim()}`;
                existingNotes.add(key);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing notes: ${e.message}`);
    }

    for (let i = 0; i < notesToImport.length; i += BATCH_SIZE) {
        const batch = notesToImport.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(note => {
                const key = `${(note.title || '').trim()}|${(note.content || '').trim()}`;
                if (existingNotes.has(key)) {
                    return Promise.reject(new Error('DUPLICATE'));
                }
                existingNotes.add(key);

                const mappedTags = Array.isArray(note.tags) ? note.tags.map(t => tagIdMapping.get(t) || t) : [];

                const cleaned = {
                    userId,
                    title: note.title || '',
                    content: note.content || '',
                    isPublic: note.isPublic || false,
                    status: note.status || 'draft',
                    parentNoteId: note.parentNoteId || null,
                    tags: mappedTags,
                    comments: note.comments || [],
                    extensions: note.extensions || [],
                    collaborators: note.collaborators || [],
                    metadata: note.metadata || null,
                    createdAt: note.createdAt || new Date().toISOString(),
                    updatedAt: note.updatedAt || new Date().toISOString()
                };

                return databases.createDocument(
                    NOTE_DB, NOTES_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                noteIdMapping.set(batch[index].id, res.value.$id);
                summary.notes.created++;
            } else {
                if (res.reason?.message === 'DUPLICATE') {
                    summary.notes.reused++;
                } else {
                    summary.notes.errors++;
                    errors.push(`Note "${batch[index]?.title || 'Untitled'}": ${res.reason?.message || 'Unknown error'}`);
                }
            }
        });

        if (i + BATCH_SIZE < notesToImport.length) await sleep(BATCH_DELAY_MS);
    }

    // Resolve parentNoteId relationships
    for (const note of notesToImport) {
        if (note.parentNoteId && noteIdMapping.has(note.parentNoteId) && noteIdMapping.has(note.id)) {
            try {
                const newNoteId = noteIdMapping.get(note.id);
                const newParentId = noteIdMapping.get(note.parentNoteId);
                await databases.updateDocument(NOTE_DB, NOTES_TABLE, newNoteId, {
                    parentNoteId: newParentId
                });
            } catch (e) {
                log(`Warning: Failed to update parentNoteId: ${e.message}`);
            }
        }
    }

    // 6. IMPORT FLOW FORMS
    const formsToImport = workspaceData.flow?.forms || [];
    log(`Importing ${formsToImport.length} flow forms...`);

    const existingForms = new Map();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(FLOW_DB, FORMS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                if (doc.title) existingForms.set(doc.title.trim().toLowerCase(), doc.$id);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing forms: ${e.message}`);
    }

    const formIdMapping = new Map();
    for (const form of formsToImport) {
        try {
            const title = (form.title || '').trim();
            if (!title) continue;

            const nameKey = title.toLowerCase();
            if (existingForms.has(nameKey)) {
                const existingId = existingForms.get(nameKey);
                formIdMapping.set(form.id, existingId);
                summary.forms.reused++;
                continue;
            }

            const clean = {
                userId,
                title,
                description: form.description || '',
                schema: form.schema || '{}',
                settings: form.settings || '{}',
                status: form.status || 'draft',
                visibility: form.visibility || 'private',
                createdAt: form.createdAt || new Date().toISOString(),
                updatedAt: form.updatedAt || new Date().toISOString()
            };

            const created = await databases.createDocument(
                FLOW_DB, FORMS_TABLE, ID.unique(), clean,
                [Permission.read(Role.user(userId))]
            );
            formIdMapping.set(form.id, created.$id);
            existingForms.set(nameKey, created.$id);
            summary.forms.created++;
        } catch (e) {
            summary.forms.errors++;
            errors.push(`Flow Form "${form.title}": ${e.message}`);
        }
    }

    // 7. IMPORT FLOW EVENTS
    const eventsToImport = workspaceData.flow?.events || [];
    log(`Importing ${eventsToImport.length} flow events...`);

    const existingEvents = new Set();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(FLOW_DB, EVENTS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                const key = `${(doc.title || '').trim()}|${doc.startTime}`;
                existingEvents.add(key);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing events: ${e.message}`);
    }

    const eventIdMapping = new Map();
    for (let i = 0; i < eventsToImport.length; i += BATCH_SIZE) {
        const batch = eventsToImport.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(event => {
                const key = `${(event.title || '').trim()}|${event.startTime}`;
                if (existingEvents.has(key)) {
                    return Promise.reject(new Error('DUPLICATE'));
                }
                existingEvents.add(key);

                const cleaned = {
                    userId,
                    title: event.title || '',
                    description: event.description || '',
                    startTime: event.startTime,
                    endTime: event.endTime,
                    location: event.location || null,
                    meetingUrl: event.meetingUrl || null,
                    visibility: event.visibility || 'private',
                    status: event.status || 'scheduled',
                    coverImageId: event.coverImageId || null,
                    maxAttendees: event.maxAttendees || 0,
                    recurrenceRule: event.recurrenceRule || null,
                    calendarId: event.calendarId || 'default',
                    createdAt: event.createdAt || new Date().toISOString(),
                    updatedAt: event.updatedAt || new Date().toISOString()
                };

                return databases.createDocument(
                    FLOW_DB, EVENTS_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                eventIdMapping.set(batch[index].id, res.value.$id);
                summary.events.created++;
            } else {
                if (res.reason?.message === 'DUPLICATE') {
                    summary.events.reused++;
                } else {
                    summary.events.errors++;
                    errors.push(`Flow Event "${batch[index]?.title || 'Untitled'}": ${res.reason?.message || 'Unknown error'}`);
                }
            }
        });

        if (i + BATCH_SIZE < eventsToImport.length) await sleep(BATCH_DELAY_MS);
    }

    // 8. IMPORT FLOW TASKS
    const tasksToImport = workspaceData.flow?.tasks || [];
    log(`Importing ${tasksToImport.length} flow tasks...`);

    const existingTasks = new Set();
    try {
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(FLOW_DB, TASKS_TABLE, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                const key = `${(doc.title || '').trim()}`;
                existingTasks.add(key);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing tasks: ${e.message}`);
    }

    for (let i = 0; i < tasksToImport.length; i += BATCH_SIZE) {
        const batch = tasksToImport.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(task => {
                const key = `${(task.title || '').trim()}`;
                if (existingTasks.has(key)) {
                    return Promise.reject(new Error('DUPLICATE'));
                }
                existingTasks.add(key);

                const eventId = task.eventId && eventIdMapping.has(task.eventId) ? eventIdMapping.get(task.eventId) : task.eventId;

                let metadata = task.metadata || null;
                if (metadata && typeof metadata === 'string') {
                    try {
                        const parsed = JSON.parse(metadata);
                        if (parsed.formId && formIdMapping.has(parsed.formId)) {
                            parsed.formId = formIdMapping.get(parsed.formId);
                            metadata = JSON.stringify(parsed);
                        }
                    } catch { /* use raw */ }
                }

                const cleaned = {
                    userId,
                    title: task.title || '',
                    description: task.description || '',
                    status: task.status || 'todo',
                    priority: task.priority || 'medium',
                    dueDate: task.dueDate || null,
                    recurrenceRule: task.recurrenceRule || null,
                    tags: task.tags || [],
                    assigneeIds: task.assigneeIds || [],
                    attachmentIds: task.attachmentIds || [],
                    eventId: eventId || null,
                    parentId: task.parentId || null,
                    isPublic: task.isPublic || false,
                    isGuest: task.isGuest || false,
                    isPinned: task.isPinned || false,
                    createdAt: task.createdAt || new Date().toISOString(),
                    updatedAt: task.updatedAt || new Date().toISOString()
                };

                return databases.createDocument(
                    FLOW_DB, TASKS_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
                summary.tasks.created++;
            } else {
                if (res.reason?.message === 'DUPLICATE') {
                    summary.tasks.reused++;
                } else {
                    summary.tasks.errors++;
                    errors.push(`Flow Task "${batch[index]?.title || 'Untitled'}": ${res.reason?.message || 'Unknown error'}`);
                }
            }
        });

        if (i + BATCH_SIZE < tasksToImport.length) await sleep(BATCH_DELAY_MS);
    }

    log(`Workspace import complete: ${JSON.stringify(summary)}`);

    return {
        success: errors.length === 0 || summary.vaultCredentials.created > 0 || summary.notes.created > 0 || summary.tasks.created > 0,
        summary,
        errors
    };
}
