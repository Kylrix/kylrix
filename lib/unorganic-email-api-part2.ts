import { Query as TablesQuery, TablesDB } from 'appwrite';
import { createHash } from 'node:crypto';
import { ID, Query, type Users, Client as NodeAppwriteClient } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG, KYLRIX_AUTH_URI } from '@/lib/appwrite/config';
import { configureInternalAppwriteClient } from '@/lib/appwrite/internal-headers';

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
    sourceApp});
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
        ctaUrl: copy.ctaUrl})};
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
          blockedReason: `Deduplicated by in-app memory cache (cached status: ${cachedStatus}).`});
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
          actorId: input.actorId || null},
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
        blockedReason: allowed ? null : (blockedReason || 'Suppressed by quota.')});

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
        metadata};

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
          blockedReason: queueRow.row.blockedReason || null});
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
          quotaRemaining});
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
        metadata: input.metadata});

      const info = await messaging.createEmail({
        messageId: ID.unique(),
        subject: copy.subject,
        content: html,
        users: [recipient.userId],
        html: true});

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
          messageId: info.$id})});

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
        quotaRemaining});
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
          blockedReason: error?.message || 'Failed to dispatch email'});
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
        quotaRemaining: 0});
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
    results: queueResults};
}

;
