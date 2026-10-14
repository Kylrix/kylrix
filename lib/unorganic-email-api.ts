import { createHash } from 'node:crypto';
import { systemTables } from '@/lib/data/system-tables';
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

type PriorityLabel = 'low' | 'medium' | 'high' | 'critical';
type QueueStatus = 'queued' | 'sending' | 'sent' | 'suppressed' | 'failed';

class EmailQueueCache {
  private cache = new Map<string, { status: string; expiresAt: number }>();

  has(queueId: string): boolean {
    const entry = this.cache.get(queueId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(queueId);
      return false;
    }
    return true;
  }

  set(queueId: string, status: string, ttlMs = 10 * 60 * 1000): void {
    this.cache.set(queueId, {
      status,
      expiresAt: Date.now() + ttlMs,
    });
  }

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

function hashQueueKey(input: string) {
  return createHash('sha256').update(input).digest('base64url').slice(0, 32);
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
  target: RecipientResolution,
): Promise<ResolvedRecipient | null> {
  const { db } = await import('@/lib/db');
  const { user: userTable } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  let foundUser: any = null;

  if (target.kind === 'userId') {
    const rows = await db.select().from(userTable).where(eq(userTable.id, target.value)).limit(1);
    foundUser = rows[0] || null;
  } else {
    const rows = await db.select().from(userTable).where(eq(userTable.email, target.value.toLowerCase())).limit(1);
    foundUser = rows[0] || null;
  }

  if (!foundUser) {
    return null;
  }

  return {
    userId: foundUser.id,
    name: foundUser.name || foundUser.email.split('@')[0],
    email: foundUser.email,
  };
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

export async function dispatchUnorganicEmails(input: UnorganicEmailDispatchInput) {
  const eventType = normalizeEventType(input.eventType);
  const sourceApp = normalizeSourceApp(input.sourceApp);
  const tables = systemTables();
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
      const recipient = await resolveRecipient(target);
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
      const recipient = await resolveRecipient(target);
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

      const cachedStatus = emailQueueCache.get(queueRowId) as QueueStatus | null;
      if (cachedStatus && ['sent', 'queued', 'sending', 'suppressed'].includes(cachedStatus)) {
        queueResults.push({
          recipientId: recipient.userId,
          email: recipient.email,
          queueRowId,
          queueStatus: cachedStatus,
          templateKey,
          priority,
          priorityScore,
          quotaRemaining: 5,
        });
        continue;
      }

      // Check Telegram dispatch
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

        await tables.createRow({
          databaseId: 'chat',
          tableId: 'unorganic_emails',
          rowId: queueRowId,
          data: {
            eventType,
            sourceApp,
            actorId: pickText(input.actorId) || null,
            recipientId: recipient.userId,
            recipientEmail: recipient.email,
            resourceType: pickText(input.resourceType) || null,
            resourceId: pickText(input.resourceId) || null,
            templateKey,
            priority: priorityScore,
            status: 'sent',
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
          },
        }).catch(() => {});

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

      // Mark queued
      emailQueueCache.set(queueRowId, 'queued');
      queueResults.push({
        recipientId: recipient.userId,
        email: recipient.email,
        queueRowId,
        queueStatus: 'queued',
        templateKey,
        priority,
        priorityScore,
        quotaRemaining: 5,
      });
    } catch (error: any) {
      if (!queueRowId) {
        queueRowId = hashQueueKey(`row:${eventType}:${sourceApp}:${recipientId}:${templateKey}`);
      }
      emailQueueCache.set(queueRowId, 'failed');

      queueResults.push({
        recipientId,
        email: target.kind === 'email' ? target.value : recipientId,
        queueRowId,
        queueStatus: 'failed',
        error: error?.message || 'Failed to dispatch notification',
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
