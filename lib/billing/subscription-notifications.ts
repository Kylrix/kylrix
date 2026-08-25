import { ID } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { renderEmailTemplate } from '@/lib/email-renderer';
import { KYLRIX_AUTH_URI } from '@/lib/appwrite/config';

const PLAN_LABELS: Record<string, string> = {
  PRO: 'Kylrix Pro',
  PRO_MONTH: 'Kylrix Pro Monthly',
  PRO_YEAR: 'Kylrix Pro Yearly'};

function formatPlanLabel(plan: string) {
  return PLAN_LABELS[plan] || plan;
}

function formatDurationLabel(months: number) {
  if (months <= 1) return '1 month';
  if (months === 12) return '12 months (1 year)';
  return `${months} months`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'});
}

async function sendTemplatedEmail(
  userId: string,
  templateId: 'subscription-update' | 'gift-coupon',
  vars: Record<string, string>) {
  const { users, messaging } = createSystemClient();
  const recipient = await users.get(userId);
  if (!recipient?.email) {
    throw new Error(`No email address found for user ${userId}`);
  }

  const rendered = await renderEmailTemplate(templateId, {
    recipientName: recipient.name || recipient.email.split('@')[0],
    ctaUrl: KYLRIX_AUTH_URI,
    ...vars});

  const info = await messaging.createEmail({
    messageId: ID.unique(),
    subject: rendered.subject,
    content: rendered.html,
    users: [userId],
    html: true});

  return info;
}

export async function notifySubscriptionActivated(input: {
  userId: string;
  plan: string;
  months: number;
  currentPeriodEnd?: string | null;
  sourceLabel?: string;
  bodyCopy?: string;
  ctaUrl?: string;
}) {
  return await sendTemplatedEmail(input.userId, 'subscription-update', {
    planLabel: formatPlanLabel(input.plan),
    durationLabel: formatDurationLabel(input.months),
    currentPeriodEnd: formatDateLabel(input.currentPeriodEnd),
    sourceLabel: input.sourceLabel || 'Kylrix Accounts',
    bodyCopy:
      input.bodyCopy ||
      `Your ${formatDurationLabel(input.months)} access is live. You can now use Pro across the ecosystem immediately.`,
    ctaUrl: input.ctaUrl || KYLRIX_AUTH_URI});
}

export async function notifyGiftSubscriptionActivated(input: {
  recipientUserId: string;
  giverName: string;
  plan: string;
  months: number;
  expiresAt?: string | null;
  giftMessage?: string | null;
}) {
  return await sendTemplatedEmail(input.recipientUserId, 'subscription-update', {
    planLabel: formatPlanLabel(input.plan),
    durationLabel: formatDurationLabel(input.months),
    currentPeriodEnd: formatDateLabel(input.expiresAt),
    sourceLabel: `Gift from ${input.giverName}`,
    bodyCopy:
      input.giftMessage ||
      `${input.giverName} just gifted you ${formatDurationLabel(input.months)} of Kylrix Pro! Your Pro privileges are active on your account immediately.`,
    ctaUrl: KYLRIX_AUTH_URI,
  });
}
