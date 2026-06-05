import { Query as TablesQuery, TablesDB } from 'appwrite';
import { createHash } from 'node:crypto';
import { ID, Query, type Users, Client as NodeAppwriteClient } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
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
  | 'call_started'
  | 'token_transfer_received'
  | 'project_invited'
  | 'subscription_expiry_reminder'
  | 'feature_announcement'
  | 'coupon_issued';

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
  token_transfer_received: 44,
  form_response_submitted: 42,
  password_shared: 38,
  note_collaborator_added: 32,
  event_registered: 28,
  group_member_added: 20,
  message_streak: 16,
  project_invited: 50,
  subscription_expiry_reminder: 95,
  feature_announcement: 70,
  coupon_issued: 80,
};

const MAX_UNORGANIC_EMAILS = 5;
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
      expiresAt: Date.now() + ttlMs,
    });
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

export const emailQueueCache = new EmailQueueCache();

function createSystemTablesClient() {
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
    templateKey].join('|');
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
    case 'project_invited':
      return {
        subject: `Invitation to join project: ${resourceTitle}`,
        title: 'Project Invitation',
        body: `${actorName} has invited you to collaborate on the project "${resourceTitle}"${rightsLabel ? ` with ${rightsLabel} permissions` : ''}.`.trim(),
        ctaText,
        ctaUrl,
      };
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
    case 'token_transfer_received':
      return {
        subject: `You received ${resourceTitle || 'a KYLRIX transfer'}`,
        title: 'KYLRIX transfer received',
        body: `${actorName} sent ${resourceTitle || 'KYLRIX tokens'} to your wallet.`.trim(),
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
    case 'subscription_expiry_reminder':
      return {
        subject: `Your Kylrix Pro subscription expires in 2 days`,
        title: 'Subscription Expiry Reminder',
        body: `Your paid Kylrix Pro subscription is expiring in 2 days. To avoid being downgraded back to the free plan, please fund your in-app wallet or renew your subscription ahead of expiry.`.trim(),
        ctaText: 'Renew Subscription',
        ctaUrl: `${KYLRIX_AUTH_URI}/accounts/settings/profile`,
      };
    case 'feature_announcement':
    case 'coupon_issued': {
      const isCoupon = input.eventType === 'coupon_issued' || Boolean(input.metadata?.couponId);
      if (isCoupon) {
        const discount = input.metadata?.discountPercent || 'a special';
        return {
          subject: pickText(input.metadata?.subject as string, 'You received a Kylrix Coupon!'),
          title: 'Special Offer',
          body: `You received a coupon for ${discount}% off Kylrix Pro. Claim it now to upgrade your workspace.`.trim(),
          ctaText: 'Claim Coupon',
          ctaUrl: pickText(input.metadata?.couponUrl as string, ctaUrl),
        };
      }
      return {
        subject: pickText(input.metadata?.subject as string, `New feature: ${resourceTitle}`),
        title: 'Feature Update',
        body: `${actorName} announced a new feature: ${resourceTitle}.`.trim(),
        ctaText,
        ctaUrl,
      };
    }
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
    .logo { margin-top: 18px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
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
        <div class="logo">
          <svg viewBox="0 0 100 100" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
            <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" />
            <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" stroke-width="3.5" stroke-linecap="round" />
            <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round" />
            <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" />
            <circle cx="50" cy="10" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="15" cy="30" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="85" cy="30" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="15" cy="70" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="50" cy="90" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="85" cy="70" r="4" fill="${theme.color}" stroke="#0A0908" stroke-width="1.5" />
            <circle cx="50" cy="50" r="5.5" fill="${theme.color}" stroke="#0A0908" stroke-width="2" />
          </svg>
        </div>
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
    TablesQuery.limit(MAX_UNORGANIC_EMAILS + 1)]);

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
      blockedReason: `Anti-spam trigger: Rapid succession block. Similar event dispatched within the last 10 minutes.`,
    };
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
        blockedReason: `Anti-spam trigger: Token transfers from the same wallet are rate-limited to 1 per hour.`,
      };
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
        blockedReason: `Anti-spam trigger: Duplicate project invitation suppressed. Already invited within the last 24 hours.`,
      };
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
      blockedReason: `Anti-spam trigger: Repeated activity threshold exceeded. Suppressing incessant ${eventType} events.`,
    };
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
        blockedReason: `Quota limit: Overridden high-priority limit of 3 ${eventType} emails per week reached.`,
      };
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
        blockedReason: `Quota limit: Ordinary email limit of 5 per month reached.`,
      };
    }

    if (ordinaryEmails7d.length >= 2) {
      return {
        allowed: false,
        blockedReason: `Quota limit: Ordinary email limit of 2 per week reached.`,
      };
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
          blockedReason: `Deduplicated by in-app memory cache (cached status: ${cachedStatus}).`,
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
          actorId: input.actorId || null,
        },
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
        blockedReason: allowed ? null : (blockedReason || 'Suppressed by quota.'),
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
        blockedReason: allowed ? null : (blockedReason || 'Suppressed by quota.'),
        metadata,
      };

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
          blockedReason: queueRow.row.blockedReason || null,
        });
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
        quotaRemaining,
      });
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
