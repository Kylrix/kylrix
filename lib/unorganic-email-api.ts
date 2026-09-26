import { Query as TablesQuery, TablesDB } from 'appwrite';
import { createHash } from 'node:crypto';
import { ID, Query, type Users, Client as NodeAppwriteClient } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { configureInternalAppwriteClient } from '@/lib/appwrite/internal-headers';

import {
  type UnorganicEmailSource,
  type UnorganicEmailEventType,
  type EventCopy,
  type SourceTheme,
  SOURCE_THEMES,
  SOURCE_PRIORITY,
  EVENT_PRIORITY,
  escapeHtml,
  redactSensitiveEnvContent,
  resolveEventCopy,
  buildEmailHtml,
} from '@/lib/email/renderer';

export type {
  UnorganicEmailSource,
  UnorganicEmailEventType,
  EventCopy,
  SourceTheme,
};
export {
  SOURCE_THEMES,
  SOURCE_PRIORITY,
  EVENT_PRIORITY,
  escapeHtml,
  redactSensitiveEnvContent,
  resolveEventCopy,
  buildEmailHtml,
};

type _UnorganicEmailRecipientInput =
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

const UNORGANIC_EMAIL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const UNORGANIC_EMAILS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.UNORGANIC_EMAILS;

type PriorityLabel = 'low' | 'medium' | 'high' | 'critical';
type QueueStatus = 'queued' | 'sending' | 'sent' | 'suppressed' | 'failed';

const _PRIORITY_RANK: Record<PriorityLabel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4};

// Memory cache for dispatched row IDs to prevent duplicate database writes and network overhead
class EmailQueueCache {
  private cache = new Map<string, { status: string; expiresAt: number }>();

  // Check if a queue ID has already been dispatched/queued recently
  has(queueId: string): boolean {
    const entry = this.cache.get(queueId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(queueId);
      return false;
    }
    return true;
  }

  // Add a queue ID to the fast memory cache (valid for 10 minutes by default)
  set(queueId: string, status: string, ttlMs = 10 * 60 * 1000): void {
    this.cache.set(queueId, {
      status,
      expiresAt: Date.now() + ttlMs});
  }

  // Inspect the cached status of a queue ID
  get(queueId: string): string | null {
    const entry = this.cache.get(queueId);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.cache.delete(queueId);
      return null;
    }
    return entry.status;
  }
}

const emailQueueCache = new EmailQueueCache();

function createSystemTablesClient() {
  const apiKey = process.env.APPWRITE_API;
  if (!apiKey) {
    console.error('[Unorganic Email API] APPWRITE_API environment variable is missing.');
  }

  const client = configureInternalAppwriteClient(
    new NodeAppwriteClient()
      .setEndpoint(APPWRITE_CONFIG.SERVER_ENDPOINT)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT || APPWRITE_CONFIG.PROJECT_ID)
      .setKey(apiKey || '')
  );

  return new TablesDB(client as any);
}

function hashQueueKey(input: string) {
  return createHash('sha256').update(input).digest('base64url').slice(0, 32);
}




function buildTemplateKey(input: UnorganicEmailDispatchInput) {
  return pickText(input.templateKey, `${normalizeSourceApp(input.sourceApp)}:${normalizeEventType(input.eventType)}`);
}

function buildDeduplicationSeed(
  input: UnorganicEmailDispatchInput,
  recipient: { userId: string; email: string },
  templateKey: string) {
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
    templateKey].join('|');
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
      TablesQuery.limit(1)]);
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
  verificationMode: 'error' | 'silent'): Promise<ResolvedRecipient | null> {
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
      email: user.email};
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
    email: target.value};
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
    status: params.status});
}

async function createOrLoadQueueRow(tablesDB: TablesDB, rowId: string, data: Record<string, unknown>) {
  const existing = await getQueueRowById(tablesDB, rowId);
  if (existing) {
    return { row: existing, created: false };
  }

  return {
    row: await tablesDB.createRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, rowId, data),
    created: true};
}

function evaluateAntiSpamAndQuota(
  sentEmails: any[],
  input: { eventType: string; resourceId?: string | null; actorId?: string | null },
  now = new Date()
): { allowed: boolean; blockedReason: string | null } {
  const eventType = input.eventType;
  const resourceId = input.resourceId || '';
  const actorId = input.actorId || '';

  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // --- 1. ANTI-SPAM DEDUPLICATION FILTERS ---

  // Check rapid succession (same eventType, same resourceId, same actorId within 10 minutes)
  const rapidSuccessionMatch = sentEmails.find(email => {
    const sentTime = new Date(email.processedAt || email.sentAt);
    return (
      sentTime >= tenMinutesAgo &&
      email.eventType === eventType &&
      (email.resourceId || '') === resourceId &&
      (email.actorId || '') === actorId
    );
  });
  if (rapidSuccessionMatch) {
    return {
      allowed: false,
      blockedReason: `Anti-spam trigger: Rapid succession block. Similar event dispatched within the last 10 minutes.`};
  }

  // Token transfer anti-spam: Max 1 email per hour from the same sender
  if (eventType === 'token_transfer_received') {
    const recentTransfer = sentEmails.find(email => {
      const sentTime = new Date(email.processedAt || email.sentAt);
      return (
        sentTime >= oneHourAgo &&
        email.eventType === 'token_transfer_received' &&
        (email.actorId || '') === actorId
      );
    });
    if (recentTransfer) {
      return {
        allowed: false,
        blockedReason: `Anti-spam trigger: Token transfers from the same wallet are rate-limited to 1 per hour.`};
    }
  }

  // Project invitation anti-spam: Max 1 email per 24 hours for the same project
  if (eventType === 'project_invited') {
    const recentInvite = sentEmails.find(email => {
      const sentTime = new Date(email.processedAt || email.sentAt);
      return (
        sentTime >= oneDayAgo &&
        email.eventType === 'project_invited' &&
        (email.resourceId || '') === resourceId
      );
    });
    if (recentInvite) {
      return {
        allowed: false,
        blockedReason: `Anti-spam trigger: Duplicate project invitation suppressed. Already invited within the last 24 hours.`};
    }
  }

  // General repeated action spam (e.g. adding and removing within 24 hours): Max 2 of the exact same event type/sender/resource in 24 hours
  const sameEvent24hCount = sentEmails.filter(email => {
    const sentTime = new Date(email.processedAt || email.sentAt);
    return (
      sentTime >= oneDayAgo &&
      email.eventType === eventType &&
      (email.resourceId || '') === resourceId &&
      (email.actorId || '') === actorId
    );
  }).length;
  if (sameEvent24hCount >= 2) {
    return {
      allowed: false,
      blockedReason: `Anti-spam trigger: Repeated activity threshold exceeded. Suppressing incessant ${eventType} events.`};
  }


  // --- 2. QUOTA LIMITS ---

  const isBypassed = eventType === 'project_invited' || 
                     eventType === 'token_transfer_received' || 
                     eventType === 'subscription_expiry_reminder';

  if (isBypassed) {
    // Special high-priority override scale: Max 3 emails per week
    const weekCount = sentEmails.filter(email => {
      const sentTime = new Date(email.processedAt || email.sentAt);
      return sentTime >= sevenDaysAgo && email.eventType === eventType;
    }).length;

    if (weekCount >= 3) {
      return {
        allowed: false,
        blockedReason: `Quota limit: Overridden high-priority limit of 3 ${eventType} emails per week reached.`};
    }
  } else {
    // Ordinary emails: Max 5 per month (30 days), and Max 2 per week (7 days)
    const ordinaryEmails30d = sentEmails.filter(email => {
      const sentTime = new Date(email.processedAt || email.sentAt);
      const isEmailBypassed = email.eventType === 'project_invited' || 
                              email.eventType === 'token_transfer_received' || 
                              email.eventType === 'subscription_expiry_reminder';
      return sentTime >= thirtyDaysAgo && !isEmailBypassed;
    });

    const ordinaryEmails7d = ordinaryEmails30d.filter(email => {
      const sentTime = new Date(email.processedAt || email.sentAt);
      return sentTime >= sevenDaysAgo;
    });

    if (ordinaryEmails30d.length >= 5) {
      return {
        allowed: false,
        blockedReason: `Quota limit: Ordinary email limit of 5 per month reached.`};
    }

    if (ordinaryEmails7d.length >= 2) {
      return {
        allowed: false,
        blockedReason: `Quota limit: Ordinary email limit of 2 per week reached.`};
    }
  }

  return { allowed: true, blockedReason: null };
}

export async function dispatchUnorganicEmails(input: UnorganicEmailDispatchInput) {
  const eventType = normalizeEventType(input.eventType);
  const sourceApp = normalizeSourceApp(input.sourceApp);
  const verificationMode = input.verificationMode === 'error' ? 'error' : 'silent';
  const { users, messaging } = createSystemClient();
  const tablesDB = createSystemTablesClient();
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
    sourceApp});
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
        ctaUrl: copy.ctaUrl})};
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

      // Check in-app deduplication cache first to prevent database queries and network overhead
      const cachedStatus = emailQueueCache.get(queueRowId) as QueueStatus | null;
      if (cachedStatus && (cachedStatus === 'sent' || cachedStatus === 'queued' || cachedStatus === 'sending' || cachedStatus === 'suppressed')) {
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: cachedStatus,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining: 5, // Default safe fallback
        });
        continue;
      }

      // 1. PREFER TELEGRAM: Check if recipient has Telegram connected and deliver instantly
      let tgDelivered = false;
      try {
        const { dispatchTelegramNotification } = await import('@/lib/services/internal/telegram-dispatch');
        let tgText = `🔔 <b>${copy.title || copy.subject}</b>\n\n${copy.body}`;
        if (copy.ctaUrl) {
          tgText += `\n\n👉 <a href="${copy.ctaUrl}">${copy.ctaText || 'Open in Kylrix'}</a>`;
        }
        tgDelivered = await dispatchTelegramNotification(recipient.userId, tgText, {
          notificationType: eventType.includes('invite') ? 'invite' : 'standard',
          title: copy.title,
          resourceType: input.resourceType || undefined,
          resourceId: input.resourceId || undefined,
        });
      } catch (tgErr) {
        console.warn('[dispatchUnorganicEmails] Telegram dispatch error:', tgErr);
      }

      if (tgDelivered) {
        const sentAt = new Date().toISOString();
        const expiresAt = new Date(now.getTime() + UNORGANIC_EMAIL_WINDOW_MS).toISOString();
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
          status: 'sent' as QueueStatus,
          dedupeKey,
          attempts: 1,
          sentAt,
          expiresAt,
          processedAt: sentAt,
          blockedReason: null,
          metadata: buildQueueMetadata({
            input: { ...input, eventType, sourceApp },
            recipient,
            copy,
            templateKey,
            priority,
            priorityScore,
            quotaRemaining: 5,
            queueRowId,
            status: 'sent',
            messageId: `telegram_${recipient.userId}_${Date.now()}`,
          }),
        };

        await createOrLoadQueueRow(tablesDB, queueRowId, baseRow).catch(() => {});
        emailQueueCache.set(queueRowId, 'sent');
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: 'sent',
          messageId: `telegram_${recipient.userId}`,
          sentAt,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining: 5,
        });
        continue;
      }

      // Fetch sent history for this recipient within the last 30 days
      const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sentHistoryRes = await tablesDB.listRows(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, [
        TablesQuery.equal('recipientId', recipient.userId),
        TablesQuery.equal('status', 'sent'),
        TablesQuery.greaterThanEqual('processedAt', thirtyDaysAgoStr),
        TablesQuery.orderDesc('processedAt'),
        TablesQuery.limit(100),
      ]);

      const decision = evaluateAntiSpamAndQuota(
        sentHistoryRes.rows,
        {
          eventType,
          resourceId: input.resourceId || null,
          actorId: input.actorId || null},
        now
      );

      const allowed = decision.allowed;
      const blockedReason = decision.blockedReason;

      // Compute remaining monthly quota for ordinary emails (5 per month)
      const ordinaryEmails30d = sentHistoryRes.rows.filter(email => {
        const isEmailBypassed = email.eventType === 'project_invited' || email.eventType === 'token_transfer_received';
        return !isEmailBypassed;
      }).length;
      const quotaRemaining = Math.max(0, 5 - ordinaryEmails30d);

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
        blockedReason: allowed ? null : (blockedReason || 'Suppressed by quota.')});

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
        blockedReason: allowed ? null : (blockedReason || 'Suppressed by quota.'),
        metadata};

      const queueRow = await createOrLoadQueueRow(tablesDB, queueRowId, baseRow);

      if (!queueRow.created) {
        const existingStatus = String(queueRow.row.status || 'sent') as QueueStatus;
        emailQueueCache.set(queueRowId, existingStatus);
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: existingStatus,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining,
          blockedReason: queueRow.row.blockedReason || null});
        continue;
      }

      // Populate in-app memory cache with the initial status of the newly created queue row
      emailQueueCache.set(queueRowId, baseRow.status);

      if (!allowed) {
        emailQueueCache.set(queueRowId, 'suppressed');
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: 'suppressed',
          blockedReason: `Suppressed by quota. Remaining window capacity: ${quotaRemaining}.`,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining});
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
        metadata: input.metadata});

      const info = await messaging.createEmail({
        messageId: ID.unique(),
        subject: copy.subject,
        content: html,
        users: [recipient.userId],
        html: true});

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
          messageId: info.$id})});

      // Update in-app memory cache to 'sent' state
      emailQueueCache.set(queueRowId, 'sent');

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
        quotaRemaining});
    } catch (error: any) {
      if (!queueRowId) {
        queueRowId = hashQueueKey(`row:${eventType}:${sourceApp}:${recipientId}:${templateKey}`);
      }
      // Populate in-app memory cache with failed state to prevent infinite error re-trigger loop
      emailQueueCache.set(queueRowId, 'failed');

      try {
        await tablesDB.updateRow(CHAT_DATABASE_ID, UNORGANIC_EMAILS_TABLE_ID, queueRowId, {
          status: 'failed',
          attempts: 1,
          processedAt: new Date().toISOString(),
          blockedReason: error?.message || 'Failed to dispatch email'});
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
        quotaRemaining: 0});
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
    results: queueResults};
}

;
