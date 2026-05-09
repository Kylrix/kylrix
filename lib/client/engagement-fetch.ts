'use client';

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
    const response = await fetch('/accounts/api/engagement/views', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await response.json().catch(() => ({}));
  } catch {
    return { accepted: false, error: 'ENGAGEMENT_TRACK_FAILED' };
  }
}
