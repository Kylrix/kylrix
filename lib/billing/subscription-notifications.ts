import { ulid } from '@/lib/utils/ulid';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { renderEmailTemplate } from '@/lib/email-renderer';

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
  const users = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (users.length === 0 || !users[0].email) {
    throw new Error(`No email address found for user ${userId}`);
  }

  const recipient = users[0];
  const rendered = await renderEmailTemplate(templateId, {
    recipientName: recipient.name || recipient.email.split('@')[0],
    ctaUrl: 'https://www.kylrix.space/accounts',
    ...vars});

  return { success: true, messageId: ulid(), subject: rendered.subject };
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
    ctaUrl: input.ctaUrl || 'https://www.kylrix.space/accounts'});
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
    ctaUrl: 'https://www.kylrix.space/accounts',
  });
}
