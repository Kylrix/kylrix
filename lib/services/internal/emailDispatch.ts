import { Registry } from '@/lib/core/di/registry';
import { type UnorganicEmailEventType, type UnorganicEmailSource } from '@/lib/unorganic-email-api';

type EmailDispatchPayload = {
  eventType?: UnorganicEmailEventType | string;
  sourceApp?: UnorganicEmailSource | string;
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
  verificationMode?: 'error' | 'silent';
  metadata?: Record<string, unknown> | null;
  dryRun?: boolean;
};

export async function dispatchEmail(payload: EmailDispatchPayload) {
  return Registry.getMessaging().dispatchUnorganicEmail({
    eventType: String(payload.eventType || '').trim(),
    sourceApp: String(payload.sourceApp || '').trim(),
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
}
