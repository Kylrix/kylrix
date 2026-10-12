import { Client, Databases, Users, Messaging, Query, ID } from 'node-appwrite';

/**
 * Scheduled Reminder Engine (Appwrite Cloud Function)
 *
 * Schedule: 0 0 * / 2 * * (Runs strictly once every 2 days)
 * Purpose: Centralized, efficient reminder engine for time-sensitive entities:
 *   1. Goals (tasks table with active dueDate within upcoming 48 hours)
 *   2. Events (events table with startTime within upcoming 48 hours)
 *   3. Subscriptions (subscriptions table with currentPeriodEnd within upcoming 48 hours)
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
  const messaging = new Messaging(client);

  const DB_ID = process.env.DATABASE_ID || 'passwordManagerDb';
  const TASKS_TABLE_ID = process.env.TASKS_TABLE_ID || 'tasks';
  const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID || 'events';
  const SUBSCRIPTIONS_TABLE_ID = process.env.SUBSCRIPTIONS_TABLE_ID || 'subscriptions';
  const UNORGANIC_EMAILS_TABLE_ID = process.env.UNORGANIC_EMAILS_TABLE_ID || 'unorganic_emails';
  const TELEGRAM_TABLE_ID = process.env.TELEGRAM_CONNECTIONS_TABLE_ID || 'telegram_connections';

  let payload = {};
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    payload = {};
  }

  // Handle single item payload if invoked explicitly for a specific task
  const singleTaskId = payload.taskId || req.headers['x-appwrite-trigger-resource-id'];
  if (singleTaskId && payload.singleItemMode) {
    return handleSingleGoalReminder({ databases, users, messaging, DB_ID, TASKS_TABLE_ID, TELEGRAM_TABLE_ID, taskId: singleTaskId, userId: payload.userId, log, error, res });
  }

  // --- SCHEDULED REMINDER BATCH ENGINE ---
  log('Starting Scheduled Reminder Engine execution...');

  const now = new Date();
  const nowIso = now.toISOString();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;
  const targetWindowEnd = new Date(now.getTime() + fortyEightHoursMs);
  const targetWindowEndIso = targetWindowEnd.toISOString();

  log(`Evaluating 48-hour window: [${nowIso}] -> [${targetWindowEndIso}]`);

  // Map to collect items grouped by userId
  // userId -> { goals: [], events: [], subscriptions: [] }
  const userItemsMap = new Map();

  function getUserRecord(uId) {
    if (!userItemsMap.has(uId)) {
      userItemsMap.set(uId, { goals: [], events: [], subscriptions: [] });
    }
    return userItemsMap.get(uId);
  }

  // 1. QUERY UPCOMING GOALS / TASKS (Strict Appwrite Query Filtering)
  let goalsCount = 0;
  try {
    const taskDocs = await databases.listDocuments(DB_ID, TASKS_TABLE_ID, [
      Query.isNotNull('dueDate'),
      Query.greaterThanEqual('dueDate', nowIso),
      Query.lessThanEqual('dueDate', targetWindowEndIso),
      Query.notEqual('status', 'completed'),
      Query.notEqual('status', 'done'),
      Query.equal('isDeleted', false),
      Query.equal('isTrash', false),
      Query.limit(100)
    ]);

    for (const task of taskDocs.documents) {
      if (task.userId) {
        getUserRecord(task.userId).goals.push(task);
        goalsCount++;
      }
    }
    log(`Fetched ${goalsCount} active goal(s) due within 48 hours.`);
  } catch (err) {
    error(`Error querying goals: ${err.message}`);
  }

  // 2. QUERY UPCOMING EVENTS (Strict Appwrite Query Filtering)
  let eventsCount = 0;
  try {
    const eventDocs = await databases.listDocuments(DB_ID, EVENTS_TABLE_ID, [
      Query.isNotNull('startTime'),
      Query.greaterThanEqual('startTime', nowIso),
      Query.lessThanEqual('startTime', targetWindowEndIso),
      Query.notEqual('status', 'cancelled'),
      Query.notEqual('status', 'completed'),
      Query.equal('isDeleted', false),
      Query.equal('isTrash', false),
      Query.limit(100)
    ]);

    for (const eventItem of eventDocs.documents) {
      if (eventItem.userId) {
        getUserRecord(eventItem.userId).events.push(eventItem);
        eventsCount++;
      }
    }
    log(`Fetched ${eventsCount} upcoming event(s) within 48 hours.`);
  } catch (err) {
    error(`Error querying events: ${err.message}`);
  }

  // 3. QUERY EXPIRING SUBSCRIPTIONS (Strict Appwrite Query Filtering)
  let subsCount = 0;
  try {
    const subDocs = await databases.listDocuments(DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.isNotNull('currentPeriodEnd'),
      Query.greaterThanEqual('currentPeriodEnd', nowIso),
      Query.lessThanEqual('currentPeriodEnd', targetWindowEndIso),
      Query.equal('status', 'active'),
      Query.limit(100)
    ]);

    for (const sub of subDocs.documents) {
      if (sub.userId) {
        getUserRecord(sub.userId).subscriptions.push(sub);
        subsCount++;
      }
    }
    log(`Fetched ${subsCount} expiring subscription(s) within 48 hours.`);
  } catch (err) {
    error(`Error querying subscriptions: ${err.message}`);
  }

  const totalUsersWithReminders = userItemsMap.size;
  log(`Found ${totalUsersWithReminders} user(s) with time-sensitive reminders.`);

  if (totalUsersWithReminders === 0) {
    return res.json({
      success: true,
      message: 'No time-sensitive reminders due in the upcoming 48-hour window.',
      stats: { totalUsers: 0, goals: goalsCount, events: eventsCount, subscriptions: subsCount }
    });
  }

  // --- AGGREGATE & DISPATCH PER USER ---
  let telegramDispatches = 0;
  let emailDispatches = 0;
  let suppressedCount = 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const executionDayKey = nowIso.substring(0, 10);

  for (const [targetUserId, items] of userItemsMap.entries()) {
    try {
      const { goals, events, subscriptions } = items;
      const dedupeKey = `reminder_digest_${targetUserId}_${executionDayKey}`;

      // ANTI-SPAM SAFEGUARD: Check unorganic_emails for deduplication / rate limits
      let isSuppressed = false;
      try {
        const existingLogs = await databases.listDocuments(DB_ID, UNORGANIC_EMAILS_TABLE_ID, [
          Query.equal('recipientId', targetUserId),
          Query.equal('dedupeKey', dedupeKey),
          Query.limit(1)
        ]);

        if (existingLogs.documents && existingLogs.documents.length > 0) {
          log(`User ${targetUserId} already received reminder digest for ${executionDayKey}. Suppressing.`);
          suppressedCount++;
          isSuppressed = true;
        }
      } catch (checkErr) {
        // Table or index might not exist; continue dispatch safely
      }

      if (isSuppressed) continue;

      // Check Monthly Email Cap / Rate Limits (Max 5 ordinary emails/month per recipient)
      const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      let sent30DaysCount = 0;
      try {
        const sentLogs = await databases.listDocuments(DB_ID, UNORGANIC_EMAILS_TABLE_ID, [
          Query.equal('recipientId', targetUserId),
          Query.equal('status', 'sent'),
          Query.greaterThanEqual('processedAt', thirtyDaysAgoStr),
          Query.limit(10)
        ]);
        sent30DaysCount = sentLogs.documents.length;
      } catch (logErr) {
        // Ignore if log table not present
      }

      let channelSent = 'none';

      // 1. Try Telegram Broadcast first (Zero SMTP overhead)
      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
      if (botToken) {
        try {
          let tgDoc = null;
          try {
            tgDoc = await databases.getDocument(DB_ID, TELEGRAM_TABLE_ID, targetUserId);
          } catch (_e) {
            const tgDocs = await databases.listDocuments(DB_ID, TELEGRAM_TABLE_ID, [
              Query.equal('userId', targetUserId),
              Query.limit(1)
            ]).catch(() => ({ documents: [] }));
            if (tgDocs.documents && tgDocs.documents.length > 0) {
              tgDoc = tgDocs.documents[0];
            }
          }

          const chatId = tgDoc?.tg_chat_id || tgDoc?.chatId;
          if (chatId) {
            let tgText = `⏰ <b>Kylrix Scheduled Reminder Digest</b>\n\n`;

            if (goals.length > 0) {
              tgText += `<b>🎯 Upcoming Goals (${goals.length}):</b>\n`;
              goals.forEach(g => {
                const dueStr = g.dueDate ? new Date(g.dueDate).toLocaleDateString() : 'Soon';
                tgText += `• ${g.title} (Due: <i>${dueStr}</i>)\n`;
              });
              tgText += `\n`;
            }

            if (events.length > 0) {
              tgText += `<b>📅 Scheduled Events (${events.length}):</b>\n`;
              events.forEach(e => {
                const startStr = e.startTime ? new Date(e.startTime).toLocaleString() : 'Soon';
                tgText += `• ${e.title} (Starts: <i>${startStr}</i>)\n`;
              });
              tgText += `\n`;
            }

            if (subscriptions.length > 0) {
              tgText += `<b>💳 Expiring Subscriptions (${subscriptions.length}):</b>\n`;
              subscriptions.forEach(s => {
                const expStr = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : 'Soon';
                tgText += `• ${s.plan || 'Pro'} Plan (Expires: <i>${expStr}</i>)\n`;
              });
              tgText += `\n`;
            }

            tgText += `👉 <a href="${appUrl}">Open Kylrix Dashboard</a>`;

            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: tgText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              })
            });

            if (tgRes.ok) {
              channelSent = 'telegram';
              telegramDispatches++;
              log(`Sent Telegram digest to user ${targetUserId}`);
            }
          }
        } catch (tgErr) {
          log(`Telegram dispatch failed for ${targetUserId}: ${tgErr.message}`);
        }
      }

      // 2. Fallback to Email if Telegram not sent and email quota allows
      if (channelSent === 'none') {
        if (sent30DaysCount >= 5) {
          log(`User ${targetUserId} has reached monthly email quota (${sent30DaysCount}/5). Suppressing email.`);
          suppressedCount++;
        } else {
          try {
            const userDoc = await users.get(targetUserId).catch(() => null);
            if (userDoc && userDoc.email && userDoc.emailVerification) {
              const emailSubject = `⏰ Kylrix Reminder: ${goals.length} Goal(s), ${events.length} Event(s) upcoming`;
              let emailBody = `<div style="font-family: Arial, sans-serif; background: #0A0908; color: #fff; padding: 24px; border-radius: 16px;">`;
              emailBody += `<h2 style="color: #A855F7;">Kylrix Scheduled Reminder Digest</h2>`;
              emailBody += `<p>Hello ${userDoc.name || 'there'}, here are your upcoming items for the next 48 hours:</p>`;

              if (goals.length > 0) {
                emailBody += `<h3>🎯 Approaching Goals</h3><ul>`;
                goals.forEach(g => {
                  emailBody += `<li><b>${escapeHtml(g.title)}</b> - Due: ${g.dueDate ? new Date(g.dueDate).toLocaleDateString() : 'Soon'}</li>`;
                });
                emailBody += `</ul>`;
              }

              if (events.length > 0) {
                emailBody += `<h3>📅 Upcoming Events</h3><ul>`;
                events.forEach(e => {
                  emailBody += `<li><b>${escapeHtml(e.title)}</b> - Starts: ${e.startTime ? new Date(e.startTime).toLocaleString() : 'Soon'}</li>`;
                });
                emailBody += `</ul>`;
              }

              if (subscriptions.length > 0) {
                emailBody += `<h3>💳 Subscription Expiry</h3><ul>`;
                subscriptions.forEach(s => {
                  emailBody += `<li><b>${escapeHtml(s.plan || 'Pro')} Plan</b> - Expires: ${s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : 'Soon'}</li>`;
                });
                emailBody += `</ul>`;
              }

              emailBody += `<p><a href="${appUrl}" style="display: inline-block; background: #A855F7; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Kylrix Workspace</a></p>`;
              emailBody += `</div>`;

              await messaging.createEmail(
                ID.unique(),
                emailSubject,
                emailBody,
                [targetUserId],
                true
              );

              channelSent = 'email';
              emailDispatches++;
              log(`Sent Email digest to user ${targetUserId} (${userDoc.email})`);
            }
          } catch (emailErr) {
            error(`Email dispatch failed for ${targetUserId}: ${emailErr.message}`);
          }
        }
      }

      // Log dispatch outcome in unorganic_emails to enforce anti-spam & rate limit tracking
      try {
        await databases.createDocument(DB_ID, UNORGANIC_EMAILS_TABLE_ID, ID.unique(), {
          eventType: 'scheduled_reminder_digest',
          sourceApp: 'flow',
          recipientId: targetUserId,
          recipientEmail: channelSent === 'email' ? 'sent@email.com' : null,
          dedupeKey: dedupeKey,
          status: channelSent !== 'none' ? 'sent' : 'suppressed',
          sentAt: channelSent !== 'none' ? nowIso : null,
          processedAt: nowIso,
          attempts: 1,
          metadata: JSON.stringify({
            goalsCount: goals.length,
            eventsCount: events.length,
            subsCount: subscriptions.length,
            channelSent
          })
        });
      } catch (logRecordErr) {
        // Table or schema non-critical log failure
      }

    } catch (userProcErr) {
      error(`Error processing reminders for user ${targetUserId}: ${userProcErr.message}`);
    }
  }

  log(`Reminder Engine completed. Telegram: ${telegramDispatches}, Email: ${emailDispatches}, Suppressed: ${suppressedCount}`);

  return res.json({
    success: true,
    stats: {
      totalUsers: totalUsersWithReminders,
      goalsEvaluated: goalsCount,
      eventsEvaluated: eventsCount,
      subscriptionsEvaluated: subsCount,
      dispatches: {
        telegram: telegramDispatches,
        email: emailDispatches,
        suppressed: suppressedCount
      }
    }
  });
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function handleSingleGoalReminder({ databases, users, messaging, DB_ID, TASKS_TABLE_ID, TELEGRAM_TABLE_ID, taskId, userId, log, error, res }) {
  try {
    const task = await databases.getDocument(DB_ID, TASKS_TABLE_ID, taskId).catch(() => null);
    if (!task) {
      log(`Goal ${taskId} not found.`);
      return res.json({ success: false, reason: 'task_not_found' });
    }

    const targetUserId = userId || task.userId;
    if (!targetUserId) {
      return res.json({ success: false, reason: 'no_target_user' });
    }

    const deadline = task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Soon';
    const ctaUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space'}/goal/${task.$id}`;
    let sentChannel = 'none';

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API;
    if (botToken) {
      try {
        let tgDoc = null;
        try {
          tgDoc = await databases.getDocument(DB_ID, TELEGRAM_TABLE_ID, targetUserId);
        } catch (_e) {
          const tgDocs = await databases.listDocuments(DB_ID, TELEGRAM_TABLE_ID, [
            Query.equal('userId', targetUserId),
            Query.limit(1)
          ]).catch(() => ({ documents: [] }));
          if (tgDocs.documents && tgDocs.documents.length > 0) {
            tgDoc = tgDocs.documents[0];
          }
        }

        const chatId = tgDoc?.tg_chat_id || tgDoc?.chatId;
        if (chatId) {
          const tgText = `⏰ <b>Goal Reminder</b>\n\n<b>${escapeHtml(task.title)}</b>\nDeadline: <i>${deadline}</i>\n\n👉 <a href="${ctaUrl}">Open Goal</a>`;
          
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: tgText,
              parse_mode: 'HTML',
              disable_web_page_preview: true
            })
          });

          if (tgRes.ok) {
            sentChannel = 'telegram';
          }
        }
      } catch (err) {
        log(`Telegram error: ${err.message}`);
      }
    }

    if (sentChannel !== 'telegram') {
      const userDoc = await users.get(targetUserId).catch(() => null);
      if (userDoc && userDoc.email && userDoc.emailVerification) {
        await messaging.createEmail(
          ID.unique(),
          `⏰ Goal Reminder: ${task.title}`,
          `<p>Reminder for your goal: <b>${escapeHtml(task.title)}</b></p><p>Deadline: ${deadline}</p><p><a href="${ctaUrl}">Open Goal</a></p>`,
          [targetUserId],
          true
        );
        sentChannel = 'email';
      }
    }

    return res.json({ success: true, taskId, sentChannel });
  } catch (err) {
    error(`Single goal reminder failed: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
}
