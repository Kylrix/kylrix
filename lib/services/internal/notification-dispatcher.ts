import { dispatchEmail } from './emailDispatch';
import { dispatchTelegramNotification } from './telegram-dispatch';

export interface SecureNotificationInput {
  targetUserId: string;
  type: 'invite' | 'standard';
  title: string;
  body: string;
  actorName?: string;
  resourceId?: string;
  resourceTitle?: string;
  resourceType?: 'project' | 'note' | 'task' | 'secret' | 'totp' | 'call' | 'huddle' | 'event' | 'form';
  permission?: string;
  ctaUrl?: string;
}

export async function dispatchSecureNotification(input: SecureNotificationInput) {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
  let ctaUrl = input.ctaUrl;
  if (!ctaUrl && input.resourceId) {
    if (input.resourceType === 'project') {
      ctaUrl = `${appBaseUrl}/workspace/${input.resourceId}`;
    } else if (input.resourceType === 'note') {
      ctaUrl = `${appBaseUrl}/idea/${input.resourceId}`;
    } else if (input.resourceType === 'task') {
      ctaUrl = `${appBaseUrl}/goal/${input.resourceId}`;
    }
  }

  const tgMessage = `🔔 <b>${input.title}</b>\n\n${input.body}${ctaUrl ? `\n\n👉 <a href="${ctaUrl}">View Details</a>` : ''}`;

  let tgSuccess = false;
  try {
    tgSuccess = await dispatchTelegramNotification(input.targetUserId, tgMessage, {
      notificationType: input.type,
      title: input.title,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });
  } catch (err) {
    console.warn('[dispatchSecureNotification] Telegram dispatch failed:', err);
  }

  if (!tgSuccess) {
    try {
      await dispatchEmail({
        eventType: input.type === 'invite' ? 'project_invited' : 'group_member_added',
        sourceApp: 'kylrix',
        actorName: input.actorName || 'A teammate',
        recipientIds: [input.targetUserId],
        resourceId: input.resourceId || null,
        resourceTitle: input.resourceTitle || null,
        resourceType: input.resourceType || null,
        rightsLabel: input.permission || null,
        templateKey: input.type === 'invite' ? 'RESOURCE_SHARED_NOTIFY' : 'STANDARD_NOTIFY',
        ctaUrl: ctaUrl || null,
        ctaText: input.type === 'invite' ? 'Join Workspace' : 'Open Notification',
      });
    } catch {}
  }

  return { success: true };
}
