import { Client, Databases, Users } from 'node-appwrite';

/**
 * Goal Reminder Dispatch Appwrite Function
 * Triggered as a scheduled execution or event for a goal reminder
 */
export default async ({ req, res, log, error }) => {
  const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '67fe9627001d97e37ef3';
  const apiKey = process.env.APPWRITE_FUNCTION_API_KEY;

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

  if (apiKey) {
    client.setKey(apiKey);
  }

  const databases = new Databases(client);
  const users = new Users(client);

  let payload = {};
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    payload = {};
  }

  const taskId = payload.taskId || req.headers['x-appwrite-trigger-resource-id'];
  const userId = payload.userId;

  if (!taskId) {
    log('No taskId provided in payload, skipping goal reminder execution.');
    return res.json({ success: false, reason: 'missing_task_id' });
  }

  try {
    // 1. Fetch goal document from database
    const DB_ID = process.env.FLOW_DATABASE_ID || 'whisperrflow';
    const TABLE_ID = process.env.TASKS_TABLE_ID || 'productivity_tasks';

    const task = await databases.getDocument(DB_ID, TABLE_ID, taskId).catch(() => null);
    if (!task) {
      log(`Goal ${taskId} not found or deleted.`);
      return res.json({ success: false, reason: 'task_not_found' });
    }

    const targetUserId = userId || task.userId;
    if (!targetUserId) {
      log(`No target user for goal ${taskId}.`);
      return res.json({ success: false, reason: 'no_target_user' });
    }

    // 2. Formulate clean message content
    const deadline = task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Soon';
    const messageTitle = `⏰ Goal Reminder: ${task.title}`;
    const messageBody = `Reminder for your goal: "${task.title}".\n\nDeadline: ${deadline}`;
    const ctaUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space'}/goal/${task.$id}`;

    // 3. Prefer Telegram broadcast if connected, fallback to email
    let sentChannel = 'none';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken) {
      try {
        // Query telegram connection for target user
        const tgDocs = await databases.listDocuments(DB_ID, 'telegram_connections', [
          `equal("userId", "${targetUserId}")`
        ]).catch(() => ({ documents: [] }));

        if (tgDocs.documents && tgDocs.documents.length > 0 && tgDocs.documents[0].chatId) {
          const chatId = tgDocs.documents[0].chatId;
          const tgText = `⏰ <b>Goal Reminder</b>\n\n<b>${task.title}</b>\nDeadline: <i>${deadline}</i>\n\n👉 <a href="${ctaUrl}">Open Goal</a>`;
          
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: tgText,
              parse_mode: 'HTML',
              disable_web_page_preview: false,
            }),
          });

          if (tgRes.ok) {
            sentChannel = 'telegram';
            log(`Reminder sent to user ${targetUserId} via Telegram broadcast.`);
          }
        }
      } catch (tgErr) {
        log(`Telegram dispatch error: ${tgErr.message}`);
      }
    }

    // Fallback to email if Telegram dispatch did not happen
    if (sentChannel !== 'telegram') {
      try {
        const userDoc = await users.get(targetUserId).catch(() => null);
        if (userDoc && userDoc.email) {
          // Trigger internal dispatch or email payload
          const { dispatchEmail } = await import('../../lib/services/internal/emailDispatch.js').catch(() => ({ dispatchEmail: null }));
          if (dispatchEmail) {
            await dispatchEmail({
              eventType: 'task_assigned',
              sourceApp: 'flow',
              actorName: 'Kylrix Flow',
              recipientIds: [targetUserId],
              recipientEmails: [userDoc.email],
              resourceId: task.$id,
              resourceTitle: task.title,
              resourceType: 'task',
              templateKey: 'STANDARD_NOTIFY',
              ctaUrl,
              ctaText: 'Open Goal',
            });
            sentChannel = 'email';
            log(`Reminder sent to user ${targetUserId} (${userDoc.email}) via Email broadcast.`);
          }
        }
      } catch (emailErr) {
        error(`Email dispatch error: ${emailErr.message}`);
      }
    }

    return res.json({ success: true, taskId, sentChannel });
  } catch (err) {
    error(`Goal reminder function failed: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};
