import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notifySubscriptionActivated } from './subscription-notifications';
import { calculateStackedSubscriptionCredit } from './subscription-stack';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';
import { assertEmailIsBillingAdmin } from '@/lib/services/internal/admin-guard';

export class SubscriptionService {
  /**
   * Ledger + prefs aligned Pro grant (admin-only). Requires ADMINS-listed actor email.
   */
  private async writeProSubscriptionDocument(
    targetUserId: string,
    planId: string,
    months: number,
    ratio = 1) {
    const { currentPeriodStart, currentPeriodEnd } = await calculateStackedSubscriptionCredit(
      null,
      targetUserId,
      planId,
      months,
      ratio);

    const planTier = String(planId).toUpperCase().startsWith('TEAMS') ? 'TEAMS' : 'PRO';

    const subId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.subscriptions).values({
      id: subId,
      userId: targetUserId,
      tier: planTier.toLowerCase(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    try {
      const userSettings = await db
        .select()
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, targetUserId))
        .limit(1);

      let prefs: Record<string, unknown> = {};
      if (userSettings.length > 0 && userSettings[0].preferences) {
        try {
          prefs = JSON.parse(userSettings[0].preferences);
        } catch {}
      }

      const updatedPrefs = applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString(), planTier);

      if (userSettings.length > 0) {
        await db
          .update(schema.userSettings)
          .set({ preferences: JSON.stringify(updatedPrefs), updatedAt: now })
          .where(eq(schema.userSettings.userId, targetUserId));
      } else {
        await db.insert(schema.userSettings).values({
          id: `settings-${targetUserId}`,
          userId: targetUserId,
          preferences: JSON.stringify(updatedPrefs),
          securityFlags: '{}',
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn('[SubscriptionService] Failed to update user prefs:', err);
    }

    try {
      await db
        .update(schema.profiles)
        .set({ status: planTier, updatedAt: now })
        .where(eq(schema.profiles.userId, targetUserId));
    } catch (err) {
      console.warn('[SubscriptionService] Failed to sync profile tier:', err);
    }

    return { currentPeriodEnd };
  }

  /**
   * Manually enable Pro for a user (support / billing). `actorEmail` must be listed in ADMINS.
   */
  async manualEnablePro(
    targetUserId: string,
    actorEmail: string,
    actorUserId: string,
    reason: string,
    durationMonths = 12) {
    assertEmailIsBillingAdmin(actorEmail);

    const trimmedReason = String(reason || '').trim();
    if (trimmedReason.length < 8) {
      throw new Error('Reason must be at least 8 characters');
    }

    const months = Math.min(Math.max(Number.parseInt(String(durationMonths), 10) || 12, 1), 120);
    const planId = months >= 12 ? 'PRO_YEAR' : 'PRO_MONTH';

    const { currentPeriodEnd } = await this.writeProSubscriptionDocument(targetUserId, planId, months, 1);

    await notifySubscriptionActivated({
      userId: targetUserId,
      plan: 'PRO',
      months,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      sourceLabel: 'Manual activation',
      bodyCopy: 'Your Pro subscription has been activated by the Accounts team.'}).catch((error) => {
      console.warn('[SubscriptionService] Failed to send manual activation email:', error);
    });

    try {
      await db.insert(schema.activityLog).values({
        id: crypto.randomUUID(),
        userId: actorUserId,
        action: 'MANUAL_ENABLE_PRO',
        resourceType: 'subscription',
        resourceId: targetUserId,
        metadata: JSON.stringify({
          reason: trimmedReason,
          actorEmail,
          durationMonths: months}),
        createdAt: new Date().toISOString()});
    } catch (err) {
      console.warn('[SubscriptionService] Activity log row skipped:', err);
    }
  }

  /**
   * Batch category grants — same admin gate; each user receives a discrete stacked subscription unit.
   */
  async grantCategoryAccess(userIds: string[], category: string, actorEmail: string, actorUserId: string) {
    assertEmailIsBillingAdmin(actorEmail);

    const cat = String(category || '').trim();
    if (cat.length < 2) throw new Error('Invalid category');

    const uniqueIds = Array.from(new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean)));
    if (!uniqueIds.length) throw new Error('No user IDs');

    const planId = 'PRO_MONTH';

    for (const userId of uniqueIds) {
      const { currentPeriodEnd } = await this.writeProSubscriptionDocument(userId, planId, 1, 1);
      await notifySubscriptionActivated({
        userId,
        plan: 'PRO',
        months: 1,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        sourceLabel: `Category access: ${cat}`,
        bodyCopy: `Your account has been granted Pro access through the ${cat} program.`}).catch((error) => {
        console.warn('[SubscriptionService] Failed to send category access email:', error);
      });
    }

    try {
      await db.insert(schema.activityLog).values({
        id: crypto.randomUUID(),
        userId: actorUserId,
        action: 'GRANT_CATEGORY_ACCESS',
        resourceType: 'subscription_batch',
        resourceId: 'BATCH',
        metadata: JSON.stringify({ category: cat, count: uniqueIds.length, actorEmail }),
        createdAt: new Date().toISOString()});
    } catch (err) {
      console.warn('[SubscriptionService] Batch activity log skipped:', err);
    }
  }
}

export const subscriptionService = new SubscriptionService();
