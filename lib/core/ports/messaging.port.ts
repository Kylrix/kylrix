export interface EmailPayload {
  to: string[];
  subject: string;
  body: string;
  html?: string;
}

export interface UnorganicEmailPayload {
  eventType: string;
  sourceApp?: string;
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
  metadata?: Record<string, any> | null;
  dryRun?: boolean;
}

export interface MessagingPort {
  /**
   * Sends a basic transactional email using standard mail transport systems.
   */
  sendEmail(payload: EmailPayload): Promise<{ success: boolean }>;

  /**
   * Dispatches specialized, template-driven ecosystem notification emails.
   */
  dispatchUnorganicEmail(
    payload: UnorganicEmailPayload
  ): Promise<{ success: boolean }>;
}
