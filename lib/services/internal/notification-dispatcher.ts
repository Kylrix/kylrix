import { dispatchEmail } from './emailDispatch';
import { dispatchTelegramNotification } from './telegram-dispatch';
import { createSystemClient } from '@/lib/appwrite-admin';

export interface SecureNotificationInput {
  targetUserId: string;
  type: 'invite' | 'standard';
  title: string;
  body: string;
  actorName?: string;
  resourceId?: string;
  resourceTitle?: string;
  resourceType?: 'project' | 'note' | 'task';
  permission?: string;
  ctaUrl?: string;
}

/**
 * Structured Secure Notification Dispatcher Layer
 * - High-importance events (e.g. invites): Defaults to email, concurrent/companion Telegram alert if linked.
 * - Standard alerts (e.g. general updates, chatter): Defaults to Telegram first, falls back to email if Telegram is not linked.
 */
export async function dispatchSecureNotification(input: SecureNotificationInput) {
  const { users } = createSystemClient();
  
  let targetEmail: string | null = null;
  try {
    const userDoc = await users.get(input.targetUserId);
    targetEmail = userDoc.email || null;
  } catch (err) {
    console.warn('[dispatchSecureNotification] Failed to fetch target user email:', err);
  }

  // Derive target CTA invite link or standard link
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
  let ctaUrl = input.ctaUrl;
  if (!ctaUrl && input.resourceId) {
    if (input.resourceType === 'project') {
      // Invite link for project is /project/[id] (not /projects/[id])
      ctaUrl = `${appBaseUrl}/project/${input.resourceId}`;
    } else if (input.resourceType === 'note') {
      ctaUrl = `${appBaseUrl}/note/shared/${input.resourceId}`;
    } else if (input.resourceType === 'task') {
      ctaUrl = `${appBaseUrl}/flow/tasks/${input.resourceId}`;
    }
  }

  const emailPayload = {
    eventType: input.type === 'invite'
      ? (input.resourceType === 'project' ? 'project_invited' : 'note_collaborator_added')
      : 'group_member_added',
    sourceApp: 'kylrix',
    actorName: input.actorName || 'A teammate',
    recipientEmails: targetEmail ? [targetEmail] : [],
    resourceId: input.resourceId || null,
    resourceTitle: input.resourceTitle || null,
    resourceType: input.resourceType || null,
    rightsLabel: input.permission || null,
    templateKey: input.type === 'invite' ? 'RESOURCE_SHARED_NOTIFY' : 'STANDARD_NOTIFY',
    ctaUrl: ctaUrl || null,
    ctaText: input.type === 'invite' ? 'Join Workspace' : 'Open Notification',
    metadata: {
      permissionType: input.permission || 'viewer',
      iconUrl: 'https://kylrix.space/logo.svg'
    }
  };

  // Build high-speed clean Telegram alert
  let tgMessage = '';
  if (input.type === 'invite') {
    tgMessage = `📬 <b>New Invitation</b>\n\n<b>${emailPayload.actorName}</b> has invited you to collaborate on the ${input.resourceType || 'resource'} <b>${input.resourceTitle || 'Untitled'}</b> with <b>${input.permission || 'viewer'}</b> access.\n\n👉 <a href="${ctaUrl || appBaseUrl}">Join Workspace</a>`;
  } else {
    tgMessage = `🔔 <b>${input.title}</b>\n\n${input.body}${ctaUrl ? `\n\n👉 <a href="${ctaUrl}">View Details</a>` : ''}`;
  }

  // Prefer Telegram and ensure at most ONE channel gets the message (never send to both)
  let tgSuccess = false;
  try {
    tgSuccess = await dispatchTelegramNotification(input.targetUserId, tgMessage);
    if (tgSuccess) {
      console.log('[dispatchSecureNotification] Primary Telegram dispatch successful');
    }
  } catch (err) {
    console.warn('[dispatchSecureNotification] Telegram dispatch failed:', err);
  }

  // If Telegram is not linked or delivery failed, fallback to Email
  if (!tgSuccess && targetEmail) {
    try {
      await dispatchEmail(emailPayload);
    } catch (err) {
      console.error('[dispatchSecureNotification] Fallback email delivery failed:', err);
    }
  }

  return { success: true };
}
