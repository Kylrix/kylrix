'use client';

import { trackEngagementViewSecure } from '@/lib/actions/secure-ops';

interface TrackEngagementPayload {
  appId: string;
  contentType: string;
  contentId: string;
  ownerUserId?: string | null;
  fingerprint?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  receiptType?: 'seen' | 'delivered' | null;
  metadata?: Record<string, unknown> | null;
}

export async function trackEngagementFromClient(payload: TrackEngagementPayload) {
  try {
    return await trackEngagementViewSecure({
      ...payload,
      ip: null,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
      occurredAt: new Date().toISOString(),
    });
  } catch {
    return { accepted: false, error: 'ENGAGEMENT_TRACK_FAILED' };
  }
}
