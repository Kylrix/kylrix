import { Client, Messaging, Databases, ID } from 'node-appwrite';

/**
 * Notify On Social Activity Function
 * Trigger: databases.chat.tables.messages.rows.*.create
 * Trigger: databases.chat.tables.follows.rows.*.create
 * Trigger: databases.chat.tables.interactions.rows.*.create
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const messaging = new Messaging(client);
    const databases = new Databases(client);

    const DB_ID_CHAT = process.env.DATABASE_ID_CHAT || 'chat';
    const COLLECTION_ID_ACTIVITY = process.env.COLLECTION_ID_ACTIVITY || 'app_activity';

    const event = req.headers['x-appwrite-event'] || '';
    const payload = req.body;

    log(`Social Activity Triggered: ${event}`);

    try {
        let targetUserId = payload.receiverId || payload.followingId || payload.targetUserId || payload.userId;
        let messageText = '';
        let activityType = 'social';
        let actionUrl = '/chats';
        let title = 'Social Activity';

        if (event.includes('messages')) {
            title = 'New Message';
            messageText = `New message from ${payload.senderName || 'someone'}`;
            actionUrl = `/chats/${payload.conversationId || ''}`;
            activityType = 'message';
        } else if (event.includes('follows')) {
            title = 'New Follower';
            messageText = `${payload.followerName || 'A user'} started following you.`;
            actionUrl = `/u/${payload.followerId || ''}`;
            activityType = 'follow';
        } else if (event.includes('interactions')) {
            title = 'New Interaction';
            messageText = `${payload.userName || 'A user'} reacted to your message.`;
            actionUrl = `/chats/${payload.conversationId || ''}`;
            activityType = 'reaction';
        }

        if (!targetUserId || !messageText) {
            log('No recipient or message content found, skipping.');
            return res.json({ success: false });
        }

        log(`Processing social notification for ${targetUserId}`);

        // 1. Appwrite Messaging (Push)
        try {
            await messaging.createMessage(
                ID.unique(),
                messageText,
                [targetUserId],
                ['push']
            );
        } catch (mErr) {
            log(`Messaging skipped: ${mErr.message}`);
        }

        // 2. Global Activity Log (The Pulse)
        // We only log non-message interactions to avoid HUD spam, 
        // or we could log all with a "read" status check.
        await databases.createDocument(
            DB_ID_CHAT,
            COLLECTION_ID_ACTIVITY,
            ID.unique(),
            {
                userId: targetUserId,
                type: activityType,
                title: title,
                content: messageText,
                actionUrl: actionUrl,
                app: 'connect',
                timestamp: new Date().toISOString(),
                read: false
            }
        );

        return res.json({ success: true });

    } catch (err) {
        error(`Social notification failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
