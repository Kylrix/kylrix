import { Client, Messaging, Databases, ID } from 'node-appwrite';

/**
 * Flow Event Sync Function
 * Trigger: databases.whisperrflow.collections.eventGuests.documents.*.create
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const messaging = new Messaging(client);
    const databases = new Databases(client);

    const payload = req.body;
    const { userId, eventTitle, startTime, organizerName, eventId } = payload;

    const DB_ID_CHAT = process.env.DATABASE_ID_CHAT || 'chat';
    const COLLECTION_ID_ACTIVITY = process.env.COLLECTION_ID_ACTIVITY || 'app_activity';

    if (!userId) {
        log('No guest userId found, skipping sync.');
        return res.json({ success: false });
    }

    try {
        log(`Syncing Flow Event "${eventTitle}" for User ${userId}`);

        // 1. Notify the guest via Appwrite Messaging (Push/Email)
        await messaging.createMessage(
            ID.unique(),
            `${organizerName || 'A teammate'} invited you to "${eventTitle}" starting at ${startTime || 'the scheduled time'}.`,
            [userId],
            ['push']
        );

        // 2. Add to Global Activity Log (The Pulse)
        // This ensures it shows up in the Ecosystem HUD/Dropdown
        await databases.createDocument(
            DB_ID_CHAT,
            COLLECTION_ID_ACTIVITY,
            ID.unique(),
            {
                userId: userId,
                type: 'flow_invite',
                title: 'New Event Invitation',
                content: `You've been invited to ${eventTitle}`,
                actionUrl: `/flow/events/${eventId}`,
                app: 'flow',
                timestamp: new Date().toISOString(),
                read: false
            }
        );

        return res.json({ success: true });

    } catch (err) {
        error(`Flow sync failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
