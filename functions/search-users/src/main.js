import { Client, Users, Databases, Query } from 'node-appwrite';

/**
 * Search Users Function
 * Trigger: HTTP (Execution API)
 * Payload: { "query": "email@example.com" or "username" }
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const users = new Users(client);
    const databases = new Databases(client);

    const DB_ID_CHAT = process.env.DATABASE_ID_CHAT || 'chat';
    const COLLECTION_ID_USERS = process.env.COLLECTION_ID_USERS || 'users';

    let payload = {};
    try {
        payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        payload = {};
    }

    const query = payload.query || '';
    if (!query || query.length < 2) {
        return res.json({ success: false, error: 'Query must be at least 2 characters' }, 400);
    }

    try {
        log(`Searching for users with query: ${query}`);

        // 1. Search Global Directory (chat.users) - Faster and contains rich profile data
        const directorySearch = await databases.listDocuments(
            DB_ID_CHAT,
            COLLECTION_ID_USERS,
            [
                Query.or([
                    Query.search('username', query),
                    Query.search('displayName', query),
                    Query.equal('email', query)
                ]),
                Query.limit(10)
            ]
        );

        if (directorySearch.total > 0) {
            log(`Found ${directorySearch.total} matches in Global Directory`);
            return res.json({ 
                success: true, 
                source: 'directory',
                users: directorySearch.documents.map(d => ({
                    id: d.$id,
                    username: d.username,
                    displayName: d.displayName,
                    avatarUrl: d.avatarUrl,
                    bio: d.bio,
                    status: d.status,
                    appsActive: d.appsActive
                }))
            });
        }

        // 2. Fallback to Admin Auth Search if no directory matches
        // (Useful for finding newly created users before sync completes)
        log('No directory matches, falling back to Auth search');
        const authResponse = await users.list([
            Query.or([
                Query.equal('email', query),
                Query.search('name', query)
            ]),
            Query.limit(5)
        ]);

        const sanitizedUsers = authResponse.users.map(u => ({
            id: u.$id,
            username: u.email.split('@')[0],
            displayName: u.name || u.email.split('@')[0],
            status: u.status ? 'online' : 'offline',
            source: 'auth'
        }));

        return res.json({ success: true, source: 'auth', users: sanitizedUsers });

    } catch (err) {
        error(`Search failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
