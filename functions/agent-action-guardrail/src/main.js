import { Client } from 'node-appwrite';

const BLOCKED_DELETION_TABLES = new Set([
    'credentials',
    'folders',
    'totpSecrets',
    'keychain',
    'key_mapping'
]);

export default async ({ req, res, log, error }) => {
    try {
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, userId, databaseId, tableId, rowId, data } = payload || {};

        if (!action || !userId) {
            return res.json({ allowed: false, reason: 'Missing required fields: action, userId' }, 400);
        }

        log(`Auditing proposed action: ${action} for user: ${userId}`);

        // Rule 1: Privileged Table Protection (No agent writes to profiles or users table directly)
        if (databaseId === 'chat' && (tableId === 'profiles' || tableId === 'users')) {
            log(`Blocked: Attempted direct write to privileged table ${tableId}`);
            return res.json({
                allowed: false,
                reason: `Mutating the user profiles table directly is strictly prohibited for security reasons.`
            });
        }

        // Rule 2: Vault Deletion Gate
        if (action === 'deleteRow' && databaseId === 'passwordManagerDb' && BLOCKED_DELETION_TABLES.has(tableId)) {
            log(`Blocked: Attempted deletion on protected vault table ${tableId}`);
            return res.json({
                allowed: false,
                reason: `Deletions on core vault tables (passwords, folders, keys) are mathematically blocked to prevent data loss.`
            });
        }

        // Rule 3: Email Spam & Broadcast Control
        if (action === 'sendEmail') {
            const emailData = data || {};
            const to = emailData.to || [];
            const body = emailData.body || '';

            if (to.length > 2) {
                log(`Blocked: Too many email recipients (${to.length})`);
                return res.json({
                    allowed: false,
                    reason: `Broadcast email campaigns are restricted. Autonomous agents are capped at 2 recipients per dispatch.`
                });
            }

            const spamKeywords = ['viagra', 'credit card', 'invest now', 'password change', 'reset login', 'confirm your password'];
            const content = String(body).toLowerCase();
            for (const word of spamKeywords) {
                if (content.includes(word)) {
                    log(`Blocked: Email content contained forbidden keyword: "${word}"`);
                    return res.json({
                        allowed: false,
                        reason: `Email dispatch blocked: Proposed content contained a highly restricted security keyword.`
                    });
                }
            }
        }

        // Rule 4: Recursive/Mass Mutation Gating
        if (action === 'createRow' && databaseId === 'whisperrflow' && tableId === 'tasks') {
            const taskData = data || {};
            if (taskData.priority === 'high' && String(taskData.title).toLowerCase().includes('emergency')) {
                log(`Flagged: Agent created high-priority emergency task`);
            }
        }

        log(`Audit approved: Action ${action} complies fully with safety negations.`);
        return res.json({ allowed: true });

    } catch (e) {
        error(`Agent Action Guardrail failed: ${e.message}`);
        return res.json({ allowed: false, reason: `Internal system safety error: ${e.message}` }, 500);
    }
};
