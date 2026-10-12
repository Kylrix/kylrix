import { Client, Users, Databases, ID } from 'node-appwrite';

/**
 * Sync Subscription Status Function
 * Trigger: databases.[NOTE_DB].collections.subscriptions.documents.*.update
 * Triggers: databases.[NOTE_DB].collections.subscriptions.documents.*.create
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
    const COLLECTION_ID_ACTIVITY = process.env.COLLECTION_ID_ACTIVITY || 'app_activity';

    const payload = req.body;
    const { userId, planId, status } = payload;

    if (!userId || !planId) {
        log('Missing subscription data, skipping.');
        return res.json({ success: false });
    }

    try {
        log(`Syncing Subscription Tier for User ${userId}: ${planId} (${status})`);

        // 1. Update Auth Labels (Server-side truth)
        const user = await users.get(userId);
        let labels = user.labels || [];
        labels = labels.filter(l => !['free', 'pro', 'premium', 'ultra', 'vip'].includes(l));

        if (status === 'active' || status === 'trialing') {
            labels.push(planId.toLowerCase());
        } else {
            labels.push('free');
        }

        await users.updateLabels(userId, labels);
        log(`Successfully applied Auth labels: ${labels.join(', ')}`);

        // 2. Update Global Directory Profile (Client-side discovery)
        try {
            await databases.updateDocument(
                DB_ID_CHAT,
                COLLECTION_ID_USERS,
                userId,
                {
                    updatedAt: new Date().toISOString()
                    // We could add a 'tier' field here if the schema allows
                }
            );
        } catch (dErr) {
            log(`Directory update skipped: ${dErr.message}`);
        }

        // 3. Notify User via Activity Log (The Pulse)
        if (status === 'active') {
            await databases.createDocument(
                DB_ID_CHAT,
                COLLECTION_ID_ACTIVITY,
                ID.unique(),
                {
                    userId: userId,
                    type: 'billing',
                    title: 'Subscription Activated',
                    content: `Your ${planId.toUpperCase()} plan is now active! Enjoy your new features.`,
                    actionUrl: '/settings',
                    app: 'accounts',
                    timestamp: new Date().toISOString(),
                    read: false
                }
            );
        }

        return res.json({ success: true, labels });

    } catch (err) {
        error(`Subscription sync failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
