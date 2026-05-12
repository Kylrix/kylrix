import { Client, Databases, ID, Permission, Role, Query } from 'node-appwrite';

/**
 * T4 Permission Updater Function
 * 
 * This function is the single authority for:
 * 1. Updating resource permissions (killing role:users).
 * 2. Managing wrapped keys in the key_mapping table.
 * 3. Handling epoch-based key rotation for group chats.
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    // Database and Table IDs
    const DB_ID_VAULT = process.env.DATABASE_ID_VAULT || 'passwordManagerDb';
    const DB_ID_CHAT = process.env.DATABASE_ID_CHAT || 'chat';
    const DB_ID_NOTE = process.env.DATABASE_ID_NOTE || '67ff05a9000296822396';

    const TABLE_ID_KEY_MAPPING = process.env.TABLE_ID_KEY_MAPPING || 'key_mapping';
    const TABLE_ID_EPOCHS = process.env.TABLE_ID_EPOCHS || 'epochs';
    const TABLE_ID_NOTES = process.env.TABLE_ID_NOTES || '67ff05f3002502ef239e';
    const TABLE_ID_CONVERSATIONS = process.env.TABLE_ID_CONVERSATIONS || 'conversations';

    let payload = {};
    try {
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return res.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    const { action, resourceId, resourceType, grantee, wrappedKey, metadata, epochNumber } = payload;

    if (!action) {
        return res.json({ success: false, error: 'Action is required' }, 400);
    }

    try {
        switch (action) {
            case 'grant':
                return await handleGrant();
            case 'revoke':
                return await handleRevoke();
            case 'rotate_epoch':
                return await handleRotateEpoch();
            case 'pin_ghost_note':
                return await handlePinGhostNote();
            default:
                return res.json({ success: false, error: `Unsupported action: ${action}` }, 400);
        }
    } catch (err) {
        error(`[T4] Action ${action} failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }

    /**
     * GRANT: Write mapping first, then widen ACL.
     */
    async function handleGrant() {
        if (!resourceId || !resourceType || !grantee || !wrappedKey) {
            return res.json({ success: false, error: 'Missing required fields for grant' }, 400);
        }

        log(`[T4] Granting access to ${grantee} for ${resourceType}:${resourceId}`);

        // 1. Write or upsert the key_mapping row
        const existingMappings = await databases.listDocuments(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, [
            Query.equal('resourceType', resourceType),
            Query.equal('resourceId', resourceId),
            Query.equal('grantee', grantee)
        ]);

        if (existingMappings.total > 0) {
            await databases.updateDocument(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, existingMappings.documents[0].$id, {
                wrappedKey,
                metadata: metadata ? JSON.stringify(metadata) : null
            });
        } else {
            await databases.createDocument(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, ID.unique(), {
                resourceId,
                resourceType,
                grantee,
                wrappedKey,
                metadata: metadata ? JSON.stringify(metadata) : null
            });
        }

        // 2. Update resource permissions
        await updateResourceACL(resourceType, resourceId, grantee, 'add');

        return res.json({ success: true });
    }

    /**
     * REVOKE: Narrow ACL first, then remove mapping.
     */
    async function handleRevoke() {
        if (!resourceId || !resourceType || !grantee) {
            return res.json({ success: false, error: 'Missing required fields for revoke' }, 400);
        }

        log(`[T4] Revoking access from ${grantee} for ${resourceType}:${resourceId}`);

        // 1. Update resource permissions (remove user)
        await updateResourceACL(resourceType, resourceId, grantee, 'remove');

        // 2. Delete the key_mapping row
        const existingMappings = await databases.listDocuments(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, [
            Query.equal('resourceType', resourceType),
            Query.equal('resourceId', resourceId),
            Query.equal('grantee', grantee)
        ]);

        for (const doc of existingMappings.documents) {
            await databases.deleteDocument(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, doc.$id);
        }

        return res.json({ success: true });
    }

    /**
     * ROTATE_EPOCH: Create epoch, fresh mappings for remaining, remove access for removed.
     */
    async function handleRotateEpoch() {
        if (!resourceId || !epochNumber || !req.body.participants) {
            return res.json({ success: false, error: 'Missing required fields for rotate_epoch' }, 400);
        }

        const participants = req.body.participants; // Array of { userId, wrappedKey }
        const actorId = req.headers['x-appwrite-user-id'];

        log(`[T4] Rotating epoch to ${epochNumber} for resource ${resourceId}`);

        // 1. Create the next epoch row
        const epoch = await databases.createDocument(DB_ID_CHAT, TABLE_ID_EPOCHS, ID.unique(), {
            resourceId,
            epochNumber,
            createdBy: actorId || 'system'
        });

        // 2. Create fresh key_mapping rows for remaining participants
        await Promise.all(participants.map(p => 
            databases.createDocument(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, ID.unique(), {
                resourceId: epoch.$id, // resourceId points to the epoch row
                resourceType: 'epoch',
                grantee: `user:${p.userId}`,
                wrappedKey: p.wrappedKey,
                metadata: metadata ? JSON.stringify(metadata) : null
            })
        ));

        // 3. Remove access for removed members (if any provided in payload)
        if (req.body.removedUserIds) {
            await Promise.all(req.body.removedUserIds.map(userId => 
                updateResourceACL('chat', resourceId, `user:${userId}`, 'remove')
            ));
        }

        return res.json({ success: true, epochId: epoch.$id });
    }

    /**
     * PIN_GHOST_NOTE: Store ghost-note secret in key_mapping.
     */
    async function handlePinGhostNote() {
        if (!resourceId || !wrappedKey) {
            return res.json({ success: false, error: 'Missing required fields for pin_ghost_note' }, 400);
        }

        const userId = req.headers['x-appwrite-user-id'];
        if (!userId) {
            return res.json({ success: false, error: 'Unauthorized: User ID missing' }, 401);
        }

        log(`[T4] Pinning ghost note ${resourceId} for user ${userId}`);

        await databases.createDocument(DB_ID_VAULT, TABLE_ID_KEY_MAPPING, ID.unique(), {
            resourceId,
            resourceType: 'ghost_note',
            grantee: `user:${userId}`,
            wrappedKey,
            metadata: metadata ? JSON.stringify(metadata) : null
        });

        return res.json({ success: true });
    }

    /**
     * Helper: Update Appwrite Document ACLs
     */
    async function updateResourceACL(type, id, grantee, operation) {
        let dbId, tableId;
        if (type === 'note' || type === 'ghost_note') {
            dbId = DB_ID_NOTE;
            tableId = TABLE_ID_NOTES;
        } else if (type === 'chat') {
            dbId = DB_ID_CHAT;
            tableId = TABLE_ID_CONVERSATIONS;
        } else {
            log(`[T4] ACL update skipped for unknown type: ${type}`);
            return;
        }

        const doc = await databases.getDocument(dbId, tableId, id);
        let permissions = doc.$permissions || [];

        // Extract ID from grantee string (e.g., "user:123" -> "123")
        const targetId = grantee.split(':')[1] || grantee;

        if (operation === 'add') {
            // Remove existing to avoid duplicates
            permissions = permissions.filter(p => !p.includes(`user:${targetId}`));
            permissions.push(Permission.read(Role.user(targetId)));
            // For notes, we might want to add update if the grant implies it
            if (payload.permission === 'write' || payload.permission === 'admin') {
                permissions.push(Permission.update(Role.user(targetId)));
            }
        } else if (operation === 'remove') {
            permissions = permissions.filter(p => !p.includes(`user:${targetId}`));
        }

        // CRITICAL: Kill role:users if it exists on this document
        permissions = permissions.filter(p => p !== 'read("users")');

        await databases.updateDocument(dbId, tableId, id, {}, permissions);
    }
};
