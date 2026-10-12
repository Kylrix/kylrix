import { Client, Databases, ID } from 'node-appwrite';

/**
 * Log Security Event Function
 * Trigger: databases.[VAULT_DB].collections.[SECURITY_LOG_COLLECTION].documents.create
 * Trigger: users.*.sessions.create (failed logins)
 * Trigger: users.*.update.password
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    const LOG_DB_ID = process.env.DATABASE_ID_CHAT || 'chat';
    const LOG_COLLECTION_ID = process.env.COLLECTION_ID_AUDIT || 'system_audit';
    const COLLECTION_ID_ACTIVITY = process.env.COLLECTION_ID_ACTIVITY || 'app_activity';

    const event = req.headers['x-appwrite-event'] || '';
    const payload = req.body;

    log(`Security Audit Triggered: ${event}`);

    try {
        const userId = payload.userId || payload.$id || 'system';
        
        // 1. Record detailed sensitive activity to a central audit trail (Admin only)
        const auditEntry = {
            userId: userId,
            eventType: event,
            details: JSON.stringify(payload),
            ip: req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            timestamp: new Date().toISOString()
        };

        log(`Recording audit for User ${userId}`);

        await databases.createDocument(
            LOG_DB_ID,
            LOG_COLLECTION_ID,
            ID.unique(),
            auditEntry
        );

        // 2. If it's a high-priority user-facing security event, add to Activity Log (HUD)
        const highPriorityEvents = [
            'users.*.update.password',
            'users.*.update.email',
            'users.*.sessions.create', // Login
            'databases.passwordManagerDb.collections.keychain' // Vault access
        ];

        if (highPriorityEvents.some(e => event.includes(e.replace('*', '')))) {
            let title = 'Security Alert';
            let content = `A security-sensitive action was detected on your account: ${event}`;
            
            if (event.includes('sessions.create')) {
                title = 'New Login Detected';
                content = `A new session was started for your account.`;
            } else if (event.includes('password')) {
                title = 'Password Updated';
                content = `Your account password was successfully changed.`;
            }

            await databases.createDocument(
                LOG_DB_ID,
                COLLECTION_ID_ACTIVITY,
                ID.unique(),
                {
                    userId: userId,
                    type: 'security',
                    title: title,
                    content: content,
                    actionUrl: '/settings',
                    app: 'accounts',
                    timestamp: new Date().toISOString(),
                    read: false
                }
            );
        }

        return res.json({ success: true });

    } catch (err) {
        error(`Audit log failed: ${err.message}`);
        return res.json({ success: false, error: err.message });
    }
};
