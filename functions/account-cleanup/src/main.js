import { Client, Databases, Query } from 'node-appwrite';

/**
 * Account Cleanup Function
 * Trigger: users.*.delete
 * Role: Admin (Full access to all databases)
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    const user = req.body;
    const userId = user?.$id;

    if (!userId) {
        log('No userId found in deletion event.');
        return res.json({ success: false });
    }

    // List of databases to scrub for this userId
    // Uses verified IDs from APPWRITE_CONFIG
    const dbs = [
        { id: process.env.DATABASE_ID_CHAT || 'chat', collections: ['users', 'contacts', 'app_activity', 'call_links'] },
        { id: process.env.DATABASE_ID_NOTE || '67ff05a9000296822396', collections: ['67ff05c900247b5673d3', 'activityLog'] }, 
        { id: process.env.DATABASE_ID_VAULT || 'passwordManagerDb', collections: ['keychain', 'identities'] }, 
        { id: process.env.DATABASE_ID_FLOW || 'whisperrflow', collections: ['tasks', 'eventGuests'] } 
    ];

    try {
        log(`Scrubbing ecosystem data for User ${userId}`);

        for (const db of dbs) {
            for (const col of db.collections) {
                try {
                    // Find all documents owned by or associated with this userId
                    const results = await databases.listDocuments(db.id, col, [
                        Query.or([
                            Query.equal('$id', userId),
                            Query.equal('userId', userId),
                            Query.equal('creatorId', userId),
                            Query.equal('ownerId', userId)
                        ]),
                        Query.limit(100)
                    ]);

                    for (const doc of results.documents) {
                        await databases.deleteDocument(db.id, col, doc.$id);
                        log(`Deleted ${doc.$id} from ${db.id}.${col}`);
                    }
                } catch (e) {
                    // Log but continue (some collections may not have the field)
                    log(`Skipping ${db.id}.${col}: ${e.message}`);
                }
            }
        }

        log(`Successfully scrubbed all data for User ${userId}`);
        return res.json({ success: true });

    } catch (err) {
        error(`Cleanup failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
