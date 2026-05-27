import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';

/**
 * Kylrix Data Porter Function
 * ---------------------------
 * Ecosystem-wide bulk data import/export with total data sovereignty.
 * 
 * Runs server-side with admin API key to bypass per-user rate limits.
 * Supports:
 *   - Import: Bitwarden JSON, Kylrix Vault JSON (V1), Kylrix Workspace JSON (V2)
 *   - Export: Full workspace snapshot (Vault, Notes, Flow) in Kylrix Workspace JSON (V2)
 * 
 * Trigger: Execution (called from client with JWT)
 * Auth:    Validates JWT user matches the requested userId
 * 
 * Payload schema:
 *   { action: 'import' | 'export', userId: string, format?: string, data?: object }
 */

// --- Constants ---
const VAULT_DB = 'passwordManagerDb';
const CREDENTIALS_TABLE = 'credentials';
const FOLDERS_TABLE = 'folders';
const TOTP_TABLE = 'totpSecrets';
const SECURITY_LOGS_TABLE = 'securityLogs';

const NOTE_DB = '67ff05a9000296822396';
const NOTES_TABLE = '67ff05f3002502ef239e';
const TAGS_TABLE = '67ff06280034908cf08a';

const FLOW_DB = 'whisperrflow';
const FORMS_TABLE = 'forms';
const TASKS_TABLE = 'tasks';
const EVENTS_TABLE = 'events';

// Bitwarden item types
const BW_TYPE_LOGIN = 1;

// Batch sizes - admin SDK has much higher limits than client
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 100; // Small delay between batches to be safe

// --- Helpers ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(url) {
    if (!url) return '';
    try {
        let normalized = url.trim().toLowerCase();
        normalized = normalized.replace(/^(https?:\/\/)?(www\.)?/, '');
        normalized = normalized.replace(/\/$/, '');
        return normalized;
    } catch {
        return (url || '').toLowerCase();
    }
}

function cleanCredential(cred, folderIdMapping, userId) {
    const clean = {
        userId,
        itemType: cred.itemType || 'login',
        name: String(cred.name || '').substring(0, 255),
        username: String(cred.username || '').substring(0, 255),
        password: String(cred.password || '').trim().substring(0, 1000),
        isFavorite: cred.isFavorite || false,
        isDeleted: cred.isDeleted || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (cred.url && typeof cred.url === 'string' && cred.url.trim()) clean.url = cred.url.trim();
    if (cred.notes && typeof cred.notes === 'string' && cred.notes.trim()) clean.notes = cred.notes.trim();

    // Map folder ID
    if (cred.folderId && folderIdMapping.has(cred.folderId)) {
        clean.folderId = folderIdMapping.get(cred.folderId);
    }

    // Tags
    if (cred.tags && Array.isArray(cred.tags) && cred.tags.length > 0) {
        clean.tags = cred.tags;
    }

    // Custom Fields
    if (cred.customFields) {
        if (typeof cred.customFields === 'string' && cred.customFields.trim()) {
            clean.customFields = cred.customFields;
        } else if (typeof cred.customFields === 'object') {
            clean.customFields = JSON.stringify(cred.customFields);
        }
    }

    // Optional card/extra fields
    for (const field of ['totpId', 'cardNumber', 'cardholderName', 'cardExpiry', 'cardCVV', 'cardPIN', 'cardType', 'faviconUrl']) {
        if (cred[field]) clean[field] = cred[field];
    }

    return clean;
}

/**
 * Map a Bitwarden export into our internal format.
 */
function mapBitwardenExport(data, userId) {
    const folders = [];
    const credentials = [];
    const totpSecrets = [];
    const folderMap = new Map(); // BW folder ID -> placeholder

    // Map folders
    if (data.folders) {
        data.folders.forEach((folder, i) => {
            folders.push({
                userId,
                name: folder.name,
                parentFolderId: null,
                icon: null,
                color: null,
                sortOrder: 0,
                isDeleted: false,
                deletedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            folderMap.set(folder.id, `folder_${i}`);
        });
    }

    // Map items
    let skipped = 0;
    if (data.items) {
        for (const item of data.items) {
            if (item.type !== BW_TYPE_LOGIN || !item.login) {
                skipped++;
                continue;
            }

            const username = item.login.username ? item.login.username.trim() : '';
            const password = item.login.password ? item.login.password.trim() : '';
            const name = item.name ? item.name.trim() : '';

            if (!username || !password || !name) {
                skipped++;
                continue;
            }

            let url = null;
            if (item.login.uris && item.login.uris.length > 0) {
                url = item.login.uris[0].uri;
            }

            let customFields = null;
            if (item.fields && item.fields.length > 0) {
                const fieldsObj = {};
                for (const f of item.fields) {
                    fieldsObj[f.name] = f.value;
                }
                customFields = JSON.stringify(fieldsObj);
            }

            let folderId = null;
            if (item.folderId && folderMap.has(item.folderId)) {
                folderId = folderMap.get(item.folderId);
            }

            credentials.push({
                userId,
                itemType: 'login',
                name,
                url,
                username,
                password,
                notes: item.notes,
                folderId,
                customFields,
                isFavorite: item.favorite || false,
                isDeleted: false,
                createdAt: item.creationDate || new Date().toISOString(),
                updatedAt: item.revisionDate || new Date().toISOString(),
            });

            // Extract TOTP
            if (item.login.totp) {
                let secretKey = item.login.totp;
                let issuer = name;
                let accountName = username;

                // Parse otpauth:// URI
                if (secretKey.startsWith('otpauth://')) {
                    try {
                        const url = new URL(secretKey);
                        secretKey = url.searchParams.get('secret') || secretKey;
                        issuer = url.searchParams.get('issuer') || issuer;
                        const path = url.pathname.replace(/^\/+/, '');
                        if (path.includes(':')) {
                            accountName = path.split(':').pop() || accountName;
                        }
                    } catch { /* use raw */ }
                }

                totpSecrets.push({
                    userId,
                    issuer,
                    accountName,
                    secretKey,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                    folderId,
                    url: url,
                    isFavorite: item.favorite || false,
                    isDeleted: false,
                    createdAt: item.creationDate || new Date().toISOString(),
                    updatedAt: item.revisionDate || new Date().toISOString(),
                });
            }
        }
    }

    return { folders, credentials, totpSecrets, skipped };
}

/**
 * Map a Kylrix Vault export back into importable format (identity/round-trip).
 */
function mapKylrixExport(data, userId) {
    return {
        folders: (data.folders || []).map(f => ({ ...f, userId })),
        credentials: (data.credentials || []).map(c => ({ ...c, userId })),
        totpSecrets: (data.totpSecrets || []).map(t => ({ ...t, userId })),
        skipped: 0,
    };
}

// --- Main Import Logic (V1 / Legacy) ---

async function runImport(databases, userId, format, data, log) {
    const summary = {
        foldersCreated: 0,
        credentialsCreated: 0,
        totpSecretsCreated: 0,
        errors: 0,
        skipped: 0,
        skippedExisting: 0,
    };
    const errors = [];

    // 1. Parse data based on format
    let mapped;
    if (format === 'bitwarden') {
        if (typeof data.encrypted !== 'boolean' || !Array.isArray(data.folders) || !Array.isArray(data.items)) {
            throw new Error('Invalid Bitwarden export format');
        }
        if (data.encrypted) {
            throw new Error('Encrypted Bitwarden exports are not supported. Please export as unencrypted JSON.');
        }
        mapped = mapBitwardenExport(data, userId);
    } else if (format === 'kylrixvault') {
        mapped = mapKylrixExport(data, userId);
    } else {
        throw new Error(`Unsupported import format: ${format}`);
    }

    summary.skipped = mapped.skipped;
    log(`Mapped data: ${mapped.folders.length} folders, ${mapped.credentials.length} credentials, ${mapped.totpSecrets.length} TOTP secrets, ${mapped.skipped} skipped`);

    // 2. Fetch existing data for dedup
    const existingFoldersMap = new Map();
    const existingCredsSet = new Set();
    const existingTotpSet = new Set();

    try {
        // Folders
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, FOLDERS_TABLE, [
                Query.equal('userId', userId), Query.limit(100), Query.offset(offset)
            ]);
            for (const f of res.documents) {
                if (f.name) existingFoldersMap.set(f.name.trim(), f.$id);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }

        // Credentials
        offset = 0;
        hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, CREDENTIALS_TABLE, [
                Query.equal('userId', userId), Query.limit(100), Query.offset(offset)
            ]);
            for (const c of res.documents) {
                const key = `${normalizeUrl(c.url)}|${(c.username || '').trim()}|${(c.password || '').trim()}`;
                existingCredsSet.add(key);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }

        // TOTP
        offset = 0;
        hasMore = true;
        while (hasMore) {
            const res = await databases.listDocuments(VAULT_DB, TOTP_TABLE, [
                Query.equal('userId', userId), Query.limit(100), Query.offset(offset)
            ]);
            for (const t of res.documents) {
                if (t.secretKey) existingTotpSet.add(t.secretKey.trim());
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        }
    } catch (e) {
        log(`Warning: Failed to fetch existing data for dedup: ${e.message}`);
    }

    // 3. Dedup
    const uniqueCredentials = [];
    for (const cred of mapped.credentials) {
        const key = `${normalizeUrl(cred.url)}|${(cred.username || '').trim()}|${(cred.password || '').trim()}`;
        if (existingCredsSet.has(key)) {
            summary.skippedExisting++;
        } else {
            uniqueCredentials.push(cred);
            existingCredsSet.add(key); // Prevent intra-batch duplicates
        }
    }

    const uniqueTotps = [];
    for (const totp of mapped.totpSecrets) {
        if (totp.secretKey && existingTotpSet.has(totp.secretKey.trim())) {
            summary.skippedExisting++;
        } else {
            uniqueTotps.push(totp);
            if (totp.secretKey) existingTotpSet.add(totp.secretKey.trim());
        }
    }

    log(`After dedup: ${mapped.folders.length} folders, ${uniqueCredentials.length} credentials (${summary.skippedExisting} dupes), ${uniqueTotps.length} TOTP secrets`);

    // 4. Import folders
    const folderIdMapping = new Map();
    for (const folder of mapped.folders) {
        try {
            const folderName = (folder.name || '').trim();
            if (!folderName) continue;

            if (existingFoldersMap.has(folderName)) {
                // Re-use existing folder
                if (folder.$id) folderIdMapping.set(folder.$id, existingFoldersMap.get(folderName));
                folderIdMapping.set(folderName, existingFoldersMap.get(folderName));
                continue;
            }

            const cleanFolder = { ...folder };
            delete cleanFolder.$id;
            delete cleanFolder.$createdAt;
            delete cleanFolder.$updatedAt;
            delete cleanFolder.$permissions;
            delete cleanFolder.$databaseId;
            delete cleanFolder.$collectionId;
            cleanFolder.userId = userId;
            cleanFolder.createdAt = new Date().toISOString();
            cleanFolder.updatedAt = new Date().toISOString();

            const created = await databases.createDocument(
                VAULT_DB, FOLDERS_TABLE, ID.unique(), cleanFolder,
                [Permission.read(Role.user(userId))]
            );

            if (folder.$id) folderIdMapping.set(folder.$id, created.$id);
            folderIdMapping.set(folderName, created.$id);
            existingFoldersMap.set(folderName, created.$id);
            summary.foldersCreated++;
        } catch (e) {
            summary.errors++;
            errors.push(`Folder "${folder.name}": ${e.message}`);
        }
    }

    // Also map placeholder IDs (folder_0, folder_1, etc. from Bitwarden mapper)
    mapped.folders.forEach((f, i) => {
        const placeholder = `folder_${i}`;
        const realId = folderIdMapping.get((f.name || '').trim());
        if (realId) folderIdMapping.set(placeholder, realId);
    });

    log(`Folders done: ${summary.foldersCreated} created, ${mapped.folders.length - summary.foldersCreated} reused/skipped`);

    // 5. Import credentials in batches
    for (let i = 0; i < uniqueCredentials.length; i += BATCH_SIZE) {
        const batch = uniqueCredentials.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(cred => {
                const cleaned = cleanCredential(cred, folderIdMapping, userId);
                return databases.createDocument(
                    VAULT_DB, CREDENTIALS_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        for (let j = 0; j < results.length; j++) {
            if (results[j].status === 'fulfilled') {
                summary.credentialsCreated++;
            } else {
                summary.errors++;
                const credName = batch[j]?.name || 'Unknown';
                errors.push(`Credential "${credName}": ${results[j].reason?.message || 'Unknown error'}`);
            }
        }

        if (i + BATCH_SIZE < uniqueCredentials.length) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    log(`Credentials done: ${summary.credentialsCreated} created`);

    // 6. Import TOTP secrets in batches
    for (let i = 0; i < uniqueTotps.length; i += BATCH_SIZE) {
        const batch = uniqueTotps.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(totp => {
                const cleaned = { ...totp };
                delete cleaned.$id;
                delete cleaned.$createdAt;
                delete cleaned.$updatedAt;
                delete cleaned.$permissions;
                delete cleaned.$databaseId;
                delete cleaned.$collectionId;
                cleaned.userId = userId;
                cleaned.createdAt = new Date().toISOString();
                cleaned.updatedAt = new Date().toISOString();

                // Map folder ID
                if (cleaned.folderId && folderIdMapping.has(cleaned.folderId)) {
                    cleaned.folderId = folderIdMapping.get(cleaned.folderId);
                } else {
                    cleaned.folderId = null;
                }

                return databases.createDocument(
                    VAULT_DB, TOTP_TABLE, ID.unique(), cleaned,
                    [Permission.read(Role.user(userId))]
                );
            })
        );

        for (let j = 0; j < results.length; j++) {
            if (results[j].status === 'fulfilled') {
                summary.totpSecretsCreated++;
            } else {
                summary.errors++;
                errors.push(`TOTP "${batch[j]?.issuer || 'Unknown'}": ${results[j].reason?.message || 'Unknown error'}`);
            }
        }

        if (i + BATCH_SIZE < uniqueTotps.length) {
            await sleep(BATCH_DELAY_MS);
        }
    }

    log(`TOTP done: ${summary.totpSecretsCreated} created`);

    return { success: summary.errors === 0 || summary.credentialsCreated > 0, summary, errors };
}

// --- Main Helper to Fetch rows in batch from any DB and Table ---

async function fetchUserRows(databases, dbId, tableId, userId, log) {
    const rows = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
        try {
            const res = await databases.listDocuments(dbId, tableId, [
                Query.equal('userId', userId),
                Query.limit(100),
                Query.offset(offset)
            ]);
            for (const doc of res.documents) {
                const clean = { ...doc };
                delete clean.$id;
                delete clean.$createdAt;
                delete clean.$updatedAt;
                delete clean.$permissions;
                delete clean.$databaseId;
                delete clean.$collectionId;
                
                clean.id = doc.$id; // Retain original ID for mapping relationships
                rows.push(clean);
            }
            offset += 100;
            hasMore = res.documents.length === 100;
        } catch (e) {
            log(`Warning: Failed to fetch from DB ${dbId}, Table ${tableId}: ${e.message}`);
            hasMore = false;
        }
    }
    return rows;
}

// --- Main Export Logic (V2.0 Workspace) ---

async function runExport(databases, userId, log) {
    log(`Fetching Vault Folders...`);
    const vaultFolders = await fetchUserRows(databases, VAULT_DB, FOLDERS_TABLE, userId, log);
    
    log(`Fetching Vault Credentials...`);
    const vaultCredentials = await fetchUserRows(databases, VAULT_DB, CREDENTIALS_TABLE, userId, log);
    
    log(`Fetching Vault TOTPs...`);
    const vaultTotpSecrets = await fetchUserRows(databases, VAULT_DB, TOTP_TABLE, userId, log);
    
    log(`Fetching Notes...`);
    const notes = await fetchUserRows(databases, NOTE_DB, NOTES_TABLE, userId, log);
    
    log(`Fetching Note Tags...`);
    const tags = await fetchUserRows(databases, NOTE_DB, TAGS_TABLE, userId, log);
    
    log(`Fetching Flow Forms...`);
    const forms = await fetchUserRows(databases, FLOW_DB, FORMS_TABLE, userId, log);
    
    log(`Fetching Flow Tasks...`);
    const tasks = await fetchUserRows(databases, FLOW_DB, TASKS_TABLE, userId, log);
    
    log(`Fetching Flow Events...`);
    const events = await fetchUserRows(databases, FLOW_DB, EVENTS_TABLE, userId, log);

    const result = {
        version: 2,
        format: 'kylrix-workspace',
        exportedAt: new Date().toISOString(),
        userId,
        data: {
            vault: {
                folders: vaultFolders,
                credentials: vaultCredentials,
                totpSecrets: vaultTotpSecrets,
            },
            notes: {
                rows: notes,
                tags: tags
            },
            flow: {
                forms,
                tasks,
                events
            }
        }
    };

    log(`Export complete: ${vaultFolders.length} folders, ${vaultCredentials.length} credentials, ${vaultTotpSecrets.length} TOTPs, ${notes.length} notes, ${tags.length} tags, ${forms.length} forms, ${tasks.length} tasks, ${events.length} events`);
    return result;
}

// --- Main Import Logic (V2.0 Workspace) ---

async function runWorkspaceImport(databases, userId, payload, log) {
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

// --- Security Logging ---

async function logSecurityEvent(databases, userId, action, details) {
    try {
        await databases.createDocument(VAULT_DB, SECURITY_LOGS_TABLE, ID.unique(), {
            userId,
            action,
            details: JSON.stringify(details),
            timestamp: new Date().toISOString(),
        }, [Permission.read(Role.user(userId))]);
    } catch { /* non-critical */ }
}

// --- Entry Point ---

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    try {
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, userId, format, data } = payload || {};

        if (!action || !userId) {
            return res.json({ success: false, error: 'Missing required fields: action, userId' }, 400);
        }

        // 1. Rate Limiting Check for Exports (Max 1 export every 12 hours)
        if (action === 'export') {
            try {
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                const recentExports = await databases.listDocuments(VAULT_DB, SECURITY_LOGS_TABLE, [
                    Query.equal('userId', userId),
                    Query.equal('action', 'DATA_EXPORT'),
                    Query.greaterThanEqual('timestamp', twelveHoursAgo),
                    Query.limit(1)
                ]);
                if (recentExports.total > 0) {
                    return res.json({ success: false, error: 'Rate limit exceeded. You can only export your data once every 12 hours.' }, 429);
                }
            } catch (e) {
                log(`Rate limit check skipped/failed: ${e.message}`);
            }
        }

        // 2. Action Router
        if (action === 'import') {
            if (!data) {
                return res.json({ success: false, error: 'Missing data payload for import' }, 400);
            }

            log(`Starting import for user ${userId}, format: ${format || 'kylrixworkspace'}`);
            
            let result;
            if (format === 'kylrixworkspace' || (format === 'kylrixvault' && data.version === 2)) {
                result = await runWorkspaceImport(databases, userId, data, log);
            } else {
                result = await runImport(databases, userId, format || 'kylrixvault', data, log);
            }

            // Log import event
            await logSecurityEvent(databases, userId, 'DATA_IMPORT', {
                format: format || 'kylrixworkspace',
                summary: result.summary,
            });

            return res.json(result);

        } else if (action === 'export') {
            log(`Starting workspace export for user ${userId}`);
            const result = await runExport(databases, userId, log);

            // Log export event
            await logSecurityEvent(databases, userId, 'DATA_EXPORT', {
                foldersCount: result.data.vault.folders.length,
                credentialsCount: result.data.vault.credentials.length,
                totpSecretsCount: result.data.vault.totpSecrets.length,
                notesCount: result.data.notes.rows.length,
                tagsCount: result.data.notes.tags.length,
                formsCount: result.data.flow.forms.length,
                tasksCount: 	result.data.flow.tasks.length,
                eventsCount: result.data.flow.events.length,
            });

            return res.json({ success: true, data: result });

        } else {
            return res.json({ success: false, error: `Unknown action: ${action}` }, 400);
        }

    } catch (e) {
        error(`Data Porter failed: ${e.message}`);
        return res.json({ success: false, error: e.message }, 500);
    }
};
