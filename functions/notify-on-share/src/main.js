import { Client, Messaging, Databases, ID, Permission, Role } from 'node-appwrite';

/**
 * Notify On Share Function
 * Trigger: databases.[NOTE_DB].collections.[COLLABORATORS_COLLECTION].documents.*
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const messaging = new Messaging(client);
    const databases = new Databases(client);

    const DB_ID_CHAT = process.env.DATABASE_ID_CHAT || 'chat';
    const COLLECTION_ID_ACTIVITY = process.env.COLLECTION_ID_ACTIVITY || 'app_activity';
    
    // Note DB Config
    const DB_ID_NOTE = '67ff05a9000296822396';
    const COLLECTION_ID_NOTES = '67ff05f3002502ef239e';

    const event = req.headers['x-appwrite-event'] || '';
    const payload = req.body;

    log(`Processing Share Event: ${event}`);

    try {
        const isDelete = event.endsWith('.delete');
        const isCreate = event.endsWith('.create');
        const isUpdate = event.endsWith('.update');

        const targetUserId = payload.userId || payload.recipientId || payload.targetUserId;
        const noteId = payload.noteId;
        const permissionLevel = payload.permission || 'read'; // 'read', 'write', 'admin'
        
        // --- 1. HANDLE NOTE PERMISSIONS (DLS) ---
        if (noteId && targetUserId) {
            log(`Updating Note ${noteId} permissions for user ${targetUserId} (${event})`);
            
            try {
                const note = await databases.getDocument(DB_ID_NOTE, COLLECTION_ID_NOTES, noteId);
                let currentPermissions = note.$permissions || [];
                
                // Remove existing permissions for this user to avoid duplicates/conflicts
                // Modern Appwrite permission string: "read(\"user:ID\")"
                currentPermissions = currentPermissions.filter(p => !p.includes(`user:${targetUserId}`));

                if (!isDelete) {
                    // Add new permissions based on level
                    currentPermissions.push(Permission.read(Role.user(targetUserId)));
                    
                    if (permissionLevel === 'write' || permissionLevel === 'admin') {
                        currentPermissions.push(Permission.update(Role.user(targetUserId)));
                    }
                    if (permissionLevel === 'admin') {
                        currentPermissions.push(Permission.delete(Role.user(targetUserId)));
                    }
                }

                await databases.updateDocument(
                    DB_ID_NOTE,
                    COLLECTION_ID_NOTES,
                    noteId,
                    {}, // No data change, just permissions
                    currentPermissions
                );
                log(`Successfully updated Note permissions.`);
            } catch (permErr) {
                error(`Failed to update Note permissions: ${permErr.message}`);
                // Continue with notification even if permission update fails? 
                // Maybe not, but for now we continue.
            }
        }

        // --- 1.5 HANDLE COLLABORATOR DOC PERMISSIONS ---
        // Give the target user read access to the collaborator document so they can query it
        if ((isCreate || isUpdate) && payload.$collectionId === 'collaborators' && targetUserId) {
            try {
                const collabDocId = payload.$id;
                const collab = await databases.getDocument(DB_ID_NOTE, 'collaborators', collabDocId);
                let collabPerms = collab.$permissions || [];
                
                if (!collabPerms.some(p => p.includes(`user:${targetUserId}`))) {
                    collabPerms.push(Permission.read(Role.user(targetUserId)));
                    await databases.updateDocument(
                        DB_ID_NOTE,
                        'collaborators',
                        collabDocId,
                        {},
                        collabPerms
                    );
                    log(`Successfully granted target user read access to collaborator doc.`);
                }
            } catch (collabPermErr) {
                error(`Failed to update Collaborator doc permissions: ${collabPermErr.message}`);
            }
        }

        // --- 2. SEND NOTIFICATIONS (Only on Create) ---
        if (isCreate && targetUserId) {
            const senderName = payload.senderName || payload.ownerName || 'A user';
            const itemId = noteId || payload.credentialId || payload.$id;
            
            let itemType = 'Resource';
            let app = 'kylrix';
            let actionUrl = '/';

            if (noteId) {
                itemType = 'Note';
                app = 'note';
                actionUrl = `/notes/${itemId}`;
            } else if (event.includes('vault') || payload.credentialId) {
                itemType = 'Secure Credential';
                app = 'vault';
                actionUrl = `/dashboard`;
            }

            log(`Sending ${itemType} share notification to ${targetUserId}`);

            try {
                // Push/Email Notification
                await messaging.createMessage(
                    ID.unique(),
                    `${senderName} shared a ${itemType} with you.`,
                    [targetUserId],
                    ['push', 'email']
                );

                // Add to Global Activity Log
                await databases.createDocument(
                    DB_ID_CHAT,
                    COLLECTION_ID_ACTIVITY,
                    ID.unique(),
                    {
                        userId: targetUserId,
                        type: 'share',
                        title: `New ${itemType} Shared`,
                        content: `${senderName} shared a ${itemType} with you.`,
                        actionUrl: actionUrl,
                        app: app,
                        timestamp: new Date().toISOString(),
                        read: false
                    }
                );
            } catch (notifyErr) {
                error(`Notification delivery failed: ${notifyErr.message}`);
            }
        }

        return res.json({ success: true });

    } catch (err) {
        error(`Function failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
