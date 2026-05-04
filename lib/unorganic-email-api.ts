import { Query as TablesQuery, TablesDB } from 'appwrite';
import { createHash } from 'node:crypto';
import { ID, Query, type Users, Client as NodeAppwriteClient } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG, KYLRIX_AUTH_URI } from '@/lib/appwrite/config';

export type UnorganicEmailSource = 'flow' | 'connect' | 'note' | 'vault' | 'accounts';

export type UnorganicEmailEventType =
  | 'group_member_added'
  | 'task_assigned'
  | 'note_collaborator_added'
  | 'form_response_submitted'
  | 'event_registered'
  | 'password_shared'
  | 'message_streak'
  | 'call_started';

export type UnorganicEmailRecipientInput =
  | { userId: string; email?: never }
  | { email: string; userId?: never };

export type UnorganicEmailDispatchInput = {
  eventType: UnorganicEmailEventType;
  sourceApp?: UnorganicEmailSource;
  verificationMode?: 'error' | 'silent';
  actorName?: string | null;
  actorId?: string | null;
  recipientIds?: string[];
  recipientEmails?: string[];
  resourceId?: string | null;
  resourceTitle?: string | null;
  resourceType?: string | null;
  rightsLabel?: string | null;
  templateKey?: string | null;
  ctaUrl?: string | null;
  ctaText?: string | null;
  metadata?: Record<string, unknown> | null;
  dryRun?: boolean;
};

type EventCopy = {
  subject: string;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
};

type SourceTheme = {
  color: string;
  shape: 'Diamond' | 'Slanted Square';
  label: string;
};

const SOURCE_THEMES: Record<UnorganicEmailSource, SourceTheme> = {
  accounts: { color: '#6366F1', shape: 'Diamond', label: 'Accounts' },
  flow: { color: '#A855F7', shape: 'Slanted Square', label: 'Flow' },
  connect: { color: '#F59E0B', shape: 'Slanted Square', label: 'Connect' },
  note: { color: '#EC4899', shape: 'Slanted Square', label: 'Note' },
  vault: { color: '#10B981', shape: 'Slanted Square', label: 'Vault' },
};

const SOURCE_PRIORITY: Record<UnorganicEmailSource, number> = {
  flow: 50,
  connect: 40,
  note: 30,
  vault: 20,
  accounts: 10,
};

const EVENT_PRIORITY: Record<UnorganicEmailEventType, number> = {
  task_assigned: 50,
  call_started: 45,
  form_response_submitted: 42,
  password_shared: 38,
  note_collaborator_added: 32,
  event_registered: 28,
  group_member_added: 20,
  message_streak: 16,
};

const MAX_UNORGANIC_EMAILS = 3;
const UNORGANIC_EMAIL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const UNORGANIC_EMAILS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.UNORGANIC_EMAILS;

type PriorityLabel = 'low' | 'medium' | 'high' | 'critical';
type QueueStatus = 'queued' | 'sending' | 'sent' | 'suppressed' | 'failed';

const PRIORITY_RANK: Record<PriorityLabel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function createAdminTablesClient() {
  const apiKey = process.env.APPWRITE_API;
  if (!apiKey) {
    console.error('[Unorganic Email API] APPWRITE_API environment variable is missing.');
  }

  const client = new NodeAppwriteClient()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || APPWRITE_CONFIG.ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT || APPWRITE_CONFIG.PROJECT_ID)
    .setKey(apiKey || '');

  return new TablesDB(client as any);
}

function hashQueueKey(input: string) {
  return createHash('sha256').update(input).digest('base64url').slice(0, 32);
}

function minimumPriorityForRemaining(remaining: number): PriorityLabel {
  if (remaining >= 3) return 'low';
  if (remaining === 2) return 'medium';
  if (remaining === 1) return 'high';
  return 'critical';
}

function isPriorityAllowed(priority: PriorityLabel, remaining: number) {
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[minimumPriorityForRemaining(remaining)];
}

function buildTemplateKey(input: UnorganicEmailDispatchInput) {
  return pickText(input.templateKey, `${normalizeSourceApp(input.sourceApp)}:${normalizeEventType(input.eventType)}`);
}

function buildDeduplicationSeed(
  input: UnorganicEmailDispatchInput,
  recipient: { userId: string; email: string },
  templateKey: string,
) {
  return [
    normalizeEventType(input.eventType),
    normalizeSourceApp(input.sourceApp),
    recipient.userId,
    recipient.email.toLowerCase(),
    pickText(input.actorId),
    pickText(input.actorName),
    pickText(input.resourceType),
    pickText(input.resourceId),
    pickText(input.resourceTitle),
    pickText(input.rightsLabel),
    templateKey,
  ].join('|');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) return text;
  }
  return '';
}

function normalizeSourceApp(input?: string | null): UnorganicEmailSource {
  const value = String(input || '').trim().toLowerCase();
  return (Object.keys(SOURCE_THEMES) as UnorganicEmailSource[]).includes(value as UnorganicEmailSource)
    ? (value as UnorganicEmailSource)
    : 'accounts';
}

function normalizeEventType(input?: string | null): UnorganicEmailEventType {
  const value = String(input || '').trim().toLowerCase();
  const allowed = Object.keys(EVENT_PRIORITY) as UnorganicEmailEventType[];
  return allowed.includes(value as UnorganicEmailEventType)
    ? (value as UnorganicEmailEventType)
    : 'group_member_added';
}

function getPriorityScore(sourceApp: UnorganicEmailSource, eventType: UnorganicEmailEventType) {
  return SOURCE_PRIORITY[sourceApp] + EVENT_PRIORITY[eventType];
}

function getPriorityLabel(score: number): PriorityLabel {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function resolveEventCopy(input: Required<Pick<UnorganicEmailDispatchInput, 'eventType' | 'sourceApp'>> & UnorganicEmailDispatchInput): EventCopy {
  const actorName = pickText(input.actorName, 'Someone') || 'Someone';
  const resourceTitle = pickText(input.resourceTitle, input.resourceType, 'this item');
  const rightsLabel = pickText(input.rightsLabel);
  const ctaUrl = pickText(input.ctaUrl, KYLRIX_AUTH_URI);
  const ctaText = pickText(input.ctaText, 'Open Kylrix');

  switch (input.eventType) {
    case 'task_assigned':
      return {
        subject: `New task assignment: ${resourceTitle}`,
        title: 'Task assignment',
        body: `${actorName} assigned you to ${resourceTitle}.${rightsLabel ? ` You have ${rightsLabel}.` : ''}`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'note_collaborator_added':
      return {
        subject: `Added to ${resourceTitle}`,
        title: 'Note collaboration',
        body: `${actorName} added you as a collaborator to ${resourceTitle}${rightsLabel ? ` with ${rightsLabel}` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'group_member_added':
      return {
        subject: `Added to ${resourceTitle}`,
        title: 'Group access',
        body: `${actorName} added you to ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'form_response_submitted':
      return {
        subject: `New response on ${resourceTitle}`,
        title: 'Form response',
        body: `${actorName} submitted a new response to ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'event_registered':
      return {
        subject: `${actorName} registered for ${resourceTitle}`,
        title: 'Event registration',
        body: `${actorName} registered for ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'password_shared':
      return {
        subject: `A secret was shared with you`,
        title: 'Vault share',
        body: `${actorName} shared a password or TOTP with you${resourceTitle ? `: ${resourceTitle}` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'message_streak':
      return {
        subject: `You have unread messages from ${actorName}`,
        title: 'Message reminder',
        body: `${actorName} has sent you multiple messages without a reply. It may be time to respond.`.trim(),
        ctaText,
        ctaUrl,
      };
    case 'call_started':
      return {
        subject: `${actorName} started a call`,
        title: 'Incoming call',
        body: `${actorName} started a call and is waiting for you to join.`.trim(),
        ctaText,
        ctaUrl,
      };
    default:
      return {
        subject: `Update from ${resourceTitle}`,
        title: 'Kylrix update',
        body: `${actorName} triggered a notification for ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
  }
}

function buildEmailHtml(params: {
  recipientName: string;
  sourceApp: UnorganicEmailSource;
  eventType: UnorganicEmailEventType;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}) {
  const theme = SOURCE_THEMES[params.sourceApp];
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #0A0908; color: #fff; font-family: Arial, sans-serif; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #161412; border: 1px solid rgba(255,255,255,0.06); border-radius: 28px; overflow: hidden; }
    .top { padding: 28px 28px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .badge { display:inline-block; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.72); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    .logo { margin-top: 18px; width: 44px; height: 44px; background: ${theme.color}; border-radius: ${theme.shape === 'Diamond' ? '10px' : '14px'}; transform: ${theme.shape === 'Diamond' ? 'rotate(45deg)' : 'skewX(-14deg)'}; }
    .content { padding: 28px; }
    .title { font-size: 26px; line-height: 1.1; font-weight: 900; margin: 0 0 16px; }
    .body { font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.72); margin: 0 0 24px; }
    .button { display:inline-block; padding: 14px 22px; background: ${theme.color}; color: #000; text-decoration:none; border-radius: 14px; font-weight: 900; }
    .footer { padding: 0 28px 28px; color: rgba(255,255,255,0.25); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="top">
        <div class="badge">${escapeHtml(theme.label)} update</div>
        <div class="logo"></div>
      </div>
      <div class="content">
        <h1 class="title">${escapeHtml(params.title)}</h1>
        <p class="body">Hello ${escapeHtml(params.recipientName)},<br><br>${escapeHtml(params.body)}</p>
        <a class="button" href="${escapeHtml(params.ctaUrl)}">${escapeHtml(params.ctaText)}</a>
      </div>
      <div class="footer">© ${year} Kylrix. Event: ${escapeHtml(params.eventType)}</div>
    </div>
  </div>
</body>
</html>`;
}

type ResolvedRecipient = { userId: string; name: string; email: string };

type RecipientResolution =
  | { kind: 'userId'; value: string }
  | { kind: 'email'; value: string };

function buildUnverifiedRecipientError(displayName: string) {
  const error = new Error(`${displayName} is not verified, ask them to verify to enable sharing.`);
  (error as any).code = 'UNVERIFIED_RECIPIENT';
  (error as any).status = 403;
  return error;
}

async function getRecipientProfile(tablesDB: TablesDB, userId: string) {
  try {
    return await tablesDB.getRow(CHAT_DATABASE_ID, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, userId);
  } catch {
    const result = await tablesDB.listRows(CHAT_DATABASE_ID, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
      TablesQuery.equal('userId', userId),
      TablesQuery.limit(1),
    ]);
    return result.rows[0] || null;
  }
}

function buildRecipientDisplayName(user: any, profile: any | null) {
  const profileName = pickText(profile?.username, profile?.displayName, profile?.name);
  if (profileName) return profileName;
  const userName = pickText(user?.name);
  if (userName) return userName;
  const emailPrefix = pickText(String(user?.email || '').split('@')[0]);
  if (emailPrefix) return emailPrefix;
  return pickText(user?.$id) || 'Someone';
}

type DispatchOutcome = {
  recipientId: string;
  email: string;
  queueRowId: string;
  queueStatus: QueueStatus;
  messageId?: string;
  sentAt?: string | null;
  blockedReason?: string | null;
  error?: string | null;
  templateKey: string;
  priority: PriorityLabel;
  priorityScore: number;
  quotaRemaining: number;
};

function normalizeRecipients(recipientIds: string[] = [], recipientEmails: string[] = []): RecipientResolution[] {
  const resolved: RecipientResolution[] = [];
  const seen = new Set<string>();

  for (const userId of recipientIds) {
    const value = String(userId || '').trim();
    if (!value) continue;
    const key = `user:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ kind: 'userId', value });
  }

  for (const email of recipientEmails) {
    const value = String(email || '').trim();
    if (!value) continue;
    const key = `email:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ kind: 'email', value });
  }

  return resolved;
}

async function resolveRecipient(
  users: Users,
  tablesDB: TablesDB,
  target: RecipientResolution,
  verificationMode: 'error' | 'silent',
): Promise<ResolvedRecipient | null> {
  if (target.kind === 'userId') {
    const user = await users.get(target.value);
    const profile = await getRecipientProfile(tablesDB, user.$id).catch(() => null);
    const displayName = buildRecipientDisplayName(user, profile);

    if (!user.email || !user.emailVerification) {
      const error = buildUnverifiedRecipientError(displayName);
      if (verificationMode === 'error') throw error;
      return null;
    }

    return {
      userId: user.$id,
      name: displayName,
      email: user.email,
    };
  }

  const found = await users.list([Query.equal('email', target.value), Query.limit(1)]);
  const user = found.users?.[0];
  if (!user) {
    throw new Error(`No Appwrite user found for ${target.value}`);
  }

  const profile = await getRecipientProfile(tablesDB, user.$id).catch(() => null);
  const displayName = buildRecipientDisplayName(user, profile);

  if (!user.emailVerification) {
    const error = buildUnverifiedRecipientError(displayName);
    if (verificationMode === 'error') throw error;
    return null;
  }

  return {
    userId: user.$id,
    name: displayName,
    email: target.value,
  };
}

async function getRecentSentCount(tablesDB: TablesDB, recipientId: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - UNORGANIC_EMAIL_WINDOW_MS);
  const response = await tablesDB.listRows(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, [
    TablesQuery.equal('recipientId', recipientId),
    TablesQuery.equal('status', 'sent'),
    TablesQuery.greaterThanEqual('sentAt', windowStart.toISOString()),
    TablesQuery.orderDesc('sentAt'),
    TablesQuery.limit(MAX_UNORGANIC_EMAILS + 1),
  ]);

  return response.rows.length;
}

async function getQueueRowById(tablesDB: TablesDB, rowId: string) {
  try {
    return await tablesDB.getRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, rowId);
  } catch (error: any) {
    if (error?.code === 404 || error?.status === 404) {
      return null;
    }
    throw error;
  }
}

function buildQueueMetadata(params: {
  input: UnorganicEmailDispatchInput;
  recipient: ResolvedRecipient;
  copy: EventCopy;
  templateKey: string;
  priority: PriorityLabel;
  priorityScore: number;
  quotaRemaining: number;
  queueRowId: string;
  status: QueueStatus;
  blockedReason?: string | null;
  messageId?: string | null;
}) {
  return JSON.stringify({
    sourceApp: normalizeSourceApp(params.input.sourceApp),
    eventType: normalizeEventType(params.input.eventType),
    templateKey: params.templateKey,
    priority: params.priority,
    priorityScore: params.priorityScore,
    quotaRemaining: params.quotaRemaining,
    queueRowId: params.queueRowId,
    messageId: params.messageId || null,
    recipientName: params.recipient.name,
    recipientEmail: params.recipient.email,
    actorName: pickText(params.input.actorName) || null,
    actorId: pickText(params.input.actorId) || null,
    resourceId: pickText(params.input.resourceId) || null,
    resourceType: pickText(params.input.resourceType) || null,
    resourceTitle: pickText(params.input.resourceTitle) || null,
    rightsLabel: pickText(params.input.rightsLabel) || null,
    subject: params.copy.subject,
    title: params.copy.title,
    ctaUrl: params.copy.ctaUrl,
    ctaText: params.copy.ctaText,
    customMetadata: params.input.metadata || null,
    blockedReason: params.blockedReason || null,
    status: params.status,
  });
}

async function createOrLoadQueueRow(tablesDB: TablesDB, rowId: string, data: Record<string, unknown>) {
  const existing = await getQueueRowById(tablesDB, rowId);
  if (existing) {
    return { row: existing, created: false };
  }

  return {
    row: await tablesDB.createRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, rowId, data),
    created: true,
  };
}

export async function dispatchUnorganicEmails(input: UnorganicEmailDispatchInput) {
  const eventType = normalizeEventType(input.eventType);
  const sourceApp = normalizeSourceApp(input.sourceApp);
  const verificationMode = input.verificationMode === 'error' ? 'error' : 'silent';
  const { users, messaging } = createAdminClient();
  const tablesDB = createAdminTablesClient();
  const recipientTargets = normalizeRecipients(input.recipientIds, input.recipientEmails);

  if (recipientTargets.length === 0) {
    throw new Error('At least one recipient is required');
  }

  const priorityScore = getPriorityScore(sourceApp, eventType);
  const priority = getPriorityLabel(priorityScore);
  const templateKey = buildTemplateKey({ ...input, eventType, sourceApp });
  const copy = resolveEventCopy({
    ...input,
    eventType,
    sourceApp,
  });
  const now = new Date();
  const queueResults: DispatchOutcome[] = [];
  const resolvedRecipients = new Set<string>();
  const verifiedRecipients: ResolvedRecipient[] = [];
  let skippedUnverified = 0;

  if (input.dryRun) {
    for (const target of recipientTargets) {
      const recipient = await resolveRecipient(users, tablesDB, target, verificationMode);
      if (!recipient) {
        skippedUnverified += 1;
        continue;
      }
      if (resolvedRecipients.has(recipient.userId)) {
        continue;
      }
      resolvedRecipients.add(recipient.userId);
      verifiedRecipients.push(recipient);
    }

    return {
      ok: true,
      dryRun: true,
      skippedUnverified,
      priority,
      priorityScore,
      sourceApp,
      eventType,
      templateKey,
      recipients: verifiedRecipients,
      subject: copy.subject,
      html: buildEmailHtml({
        recipientName: verifiedRecipients[0]?.name || 'Someone',
        sourceApp,
        eventType,
        title: copy.title,
        body: copy.body,
        ctaText: copy.ctaText,
        ctaUrl: copy.ctaUrl,
      }),
    };
  }

  for (const target of recipientTargets) {
    let queueRowId = '';
    let recipientId = target.value;

    try {
      const recipient = await resolveRecipient(users, tablesDB, target, verificationMode);
      if (!recipient) {
        skippedUnverified += 1;
        continue;
      }
      if (resolvedRecipients.has(recipient.userId)) {
        continue;
      }
      resolvedRecipients.add(recipient.userId);
      recipientId = recipient.userId;
      const queueSeed = buildDeduplicationSeed({ ...input, eventType, sourceApp }, recipient, templateKey);
      const dedupeKey = hashQueueKey(queueSeed);
      queueRowId = hashQueueKey(`row:${queueSeed}`);
      const quotaUsed = await getRecentSentCount(tablesDB, recipient.userId, now);
      const quotaRemaining = Math.max(0, MAX_UNORGANIC_EMAILS - quotaUsed);
      const allowed = quotaRemaining > 0 && isPriorityAllowed(priority, quotaRemaining);
      const expiresAt = new Date(now.getTime() + UNORGANIC_EMAIL_WINDOW_MS).toISOString();
      const metadata = buildQueueMetadata({
        input: { ...input, eventType, sourceApp },
        recipient,
        copy,
        templateKey,
        priority,
        priorityScore,
        quotaRemaining,
        queueRowId,
        status: allowed ? 'queued' : 'suppressed',
        blockedReason: allowed ? null : `Suppressed by quota. Remaining window capacity: ${quotaRemaining}.`,
      });

      const baseRow = {
        eventType,
        sourceApp,
        actorId: pickText(input.actorId) || null,
        recipientId: recipient.userId,
        recipientEmail: recipient.email,
        resourceType: pickText(input.resourceType) || null,
        resourceId: pickText(input.resourceId) || null,
        templateKey,
        priority: priorityScore,
        status: (allowed ? 'queued' : 'suppressed') as QueueStatus,
        dedupeKey,
        attempts: allowed ? 1 : 0,
        sentAt: null,
        expiresAt,
        processedAt: now.toISOString(),
        blockedReason: allowed ? null : `Suppressed by quota. Remaining window capacity: ${quotaRemaining}.`,
        metadata,
      };

      const queueRow = await createOrLoadQueueRow(tablesDB, queueRowId, baseRow);

      if (!queueRow.created) {
        const existingStatus = String(queueRow.row.status || 'sent') as QueueStatus;
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: existingStatus,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining,
          blockedReason: queueRow.row.blockedReason || null,
        });
        continue;
      }

      if (!allowed) {
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: 'suppressed',
          blockedReason: `Suppressed by quota. Remaining window capacity: ${quotaRemaining}.`,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining,
        });
        continue;
      }

      const html = buildEmailHtml({
        recipientName: recipient.name,
        sourceApp,
        eventType,
        title: copy.title,
        body: copy.body,
        ctaText: copy.ctaText,
        ctaUrl: copy.ctaUrl,
      });

      const info = await messaging.createEmail({
        messageId: ID.unique(),
        subject: copy.subject,
        content: html,
        users: [recipient.userId],
        html: true,
      });

      const sentAt = new Date().toISOString();
      await tablesDB.updateRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, queueRowId, {
        status: 'sent',
        attempts: 1,
        sentAt,
        processedAt: sentAt,
        blockedReason: null,
        metadata: buildQueueMetadata({
          input: { ...input, eventType, sourceApp },
          recipient,
          copy,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining,
          queueRowId,
          status: 'sent',
          messageId: info.$id,
        }),
      });

      queueResults.push({
        recipientId: recipient.userId,
        email: recipient.email,
        queueRowId,
        queueStatus: 'sent',
        messageId: info.$id,
        sentAt,
        templateKey,
        priority,
        priorityScore,
        quotaRemaining,
      });
    } catch (error: any) {
      if (!queueRowId) {
        queueRowId = hashQueueKey(`row:${eventType}:${sourceApp}:${recipientId}:${templateKey}`);
      }

      try {
        await tablesDB.updateRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, queueRowId, {
          status: 'failed',
          attempts: 1,
          processedAt: new Date().toISOString(),
          blockedReason: error?.message || 'Failed to dispatch email',
        });
      } catch {
        // If the queue row never existed, preserve the original failure below.
      }

      queueResults.push({
        recipientId,
        email: target.kind === 'email' ? target.value : recipientId,
        queueRowId,
        queueStatus: 'failed',
        error: error?.message || 'Failed to dispatch email',
        blockedReason: error?.message || null,
        templateKey,
        priority,
        priorityScore,
        quotaRemaining: 0,
      });
    }
  }

  return {
    ok: true,
    dryRun: false,
    skippedUnverified,
    priority,
    priorityScore,
    sourceApp,
    eventType,
    templateKey,
    sent: queueResults.filter((result) => result.queueStatus === 'sent').length,
    suppressed: queueResults.filter((result) => result.queueStatus === 'suppressed').length,
    failed: queueResults.filter((result) => result.queueStatus === 'failed').length,
    results: queueResults,
  };
}

export { getPriorityScore, getPriorityLabel, resolveEventCopy, SOURCE_THEMES };
