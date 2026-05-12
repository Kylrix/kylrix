import { Client, Databases, Query, ID } from 'node-appwrite';

/**
 * Connect Call Cleanup Function
 * Trigger: databases.chat.tables.call_links.rows.*.delete
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    const CHAT_DB_ID = process.env.DATABASE_ID_CHAT || 'chat';
    const CALL_LOGS_TABLE = process.env.COLLECTION_ID_CALL_LOGS || 'call_logs';
    const USERS_TABLE = process.env.COLLECTION_ID_USERS || 'users';

    // The deleted row data is available in the request body
    const payload = req.body;

    if (!payload.userId && !payload.creatorId) {
        log('No userId/creatorId found in payload, checking for code...');
        if (!payload.code) {
             return res.json({ success: false, message: 'Incomplete call link data' });
        }
    }

    const userId = payload.userId || payload.creatorId;

    try {
        log(`Cleaning up call for User ${userId} (Code: ${payload.code})`);

        // 1. Archive the final call log entry
        await databases.createDocument(
            CHAT_DB_ID,
            CALL_LOGS_TABLE,
            ID.unique(),
            {
                callerId: userId,
                type: payload.type || 'video',
                status: 'completed',
                duration: payload.duration || 0,
                startedAt: payload.$createdAt,
                endedAt: new Date().toISOString(),
                conversationId: payload.conversationId || null
            }
        );

        // 2. Clear "in-call" status from Global Directory if it exists
        if (userId) {
            try {
                await databases.updateDocument(
                    CHAT_DB_ID,
                    USERS_TABLE,
                    userId,
                    {
                        status: 'online', // Revert to online from 'busy' or 'in-call'
                        updatedAt: new Date().toISOString()
                    }
                );
                log(`Reset presence status for User ${userId}`);
            } catch (uErr) {
                log(`Presence reset skipped/failed: ${uErr.message}`);
            }
        }

        log('Call cleanup and archiving complete.');
        return res.json({ success: true });

    } catch (err) {
        error(`Cleanup failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
