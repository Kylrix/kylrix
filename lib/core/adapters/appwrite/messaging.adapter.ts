import { MessagingPort, EmailPayload, UnorganicEmailPayload } from '../../ports/messaging.port';
import { dispatchUnorganicEmails } from '@/lib/unorganic-email-api';

export class AppwriteMessagingAdapter implements MessagingPort {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean }> {
    // Basic SMTP / system fallback.
    // In current production, all emails are unorganic template-based.
    // We provide a console log or mock success to keep it compatible.
    console.log('[AppwriteMessagingAdapter] sendEmail requested:', payload);
    return { success: true };
  }

  async dispatchUnorganicEmail(
    payload: UnorganicEmailPayload
  ): Promise<{ success: boolean }> {
    try {
      await dispatchUnorganicEmails({
        eventType: payload.eventType as any,
        sourceApp: payload.sourceApp as any,
        actorName: payload.actorName || null,
        actorId: payload.actorId || null,
        recipientIds: payload.recipientIds || [],
        recipientEmails: payload.recipientEmails || [],
        resourceId: payload.resourceId || null,
        resourceTitle: payload.resourceTitle || null,
        resourceType: payload.resourceType || null,
        rightsLabel: payload.rightsLabel || null,
        templateKey: payload.templateKey || null,
        ctaUrl: payload.ctaUrl || null,
        ctaText: payload.ctaText || null,
        verificationMode: payload.verificationMode === 'error' ? 'error' : 'silent',
        metadata: payload.metadata || null,
        dryRun: Boolean(payload.dryRun),
      });
      return { success: true };
    } catch (err) {
      console.error('[AppwriteMessagingAdapter] Failed to dispatch unorganic email:', err);
      return { success: false };
    }
  }
}
