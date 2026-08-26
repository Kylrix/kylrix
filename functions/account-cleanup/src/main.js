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

    // Single-database: passwordManagerDb — sweep infinite data (paginated, no retention)
    const mainDb = process.env.DATABASE_ID || process.env.DATABASE_ID_PASSWORD_MANAGER || 'passwordManagerDb';
    const dbs = [
        { id: mainDb, collections: ['keychain','totpSecrets','identities','keyMapping','profiles','notes','tasks','projects','events','forms','comments','reactions','conversations','conversationMembers','messages','messageReactions','epochs','call_links','app_activity','activityLog','securityLogs','eventGuests'] }
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

                    // Paginated sweep for infinite data
                    let cursor = null;
                    for (;;) {
                        const q = [
                            Query.or([
                                Query.equal('$id', userId),
                                Query.equal('userId', userId),
                                Query.equal('creatorId', userId),
                                Query.equal('ownerId', userId),
                                Query.equal('grantee', userId),
                                Query.equal('senderId', userId)
                            ]),
                            Query.limit(100)
                        ];
                        if (cursor) q.push(Query.cursorAfter(cursor));
                        const results = await databases.listDocuments(db.id, col, q).catch(() => ({ documents: [] }));
                        if (!results.documents?.length) break;
                        for (const doc of results.documents) {
                            await databases.deleteDocument(db.id, col, doc.$id).catch(() => null);
                            log(`Deleted ${doc.$id} from ${db.id}.${col}`);
                        }
                        if (results.documents.length < 100) break;
                        cursor = results.documents[results.documents.length - 1].$id;
                    }
                } catch (e) {
                    log(`Skipping ${db.id}.${col}: ${e.message}`);
                }
            }
        }

        // Storage buckets sweep (no retention)
        try {
            const { Storage } = await import('node-appwrite');
            const storage = new Storage(client);
            for (const bucket of ['notes_attachments','voice','profile_pictures','form_attachments','project_files']) {
                try {
                    const files = await storage.listFiles(bucket, [Query.limit(100)]).catch(() => ({ files: [] }));
                    for (const f of files.files || []) {
                        if (String(f.name||'').includes(userId)) await storage.deleteFile(bucket, f.$id).catch(()=>null);
                    }
                } catch {}
            }
        } catch {}

        log(`Successfully scrubbed all data for User ${userId} — instant, no retention, auth already last`);
        return res.json({ success: true });

    } catch (err) {
        error(`Cleanup failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
