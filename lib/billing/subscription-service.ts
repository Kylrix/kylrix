import { createAdminClient } from '../appwrite-admin';
import { ID, Query, Permission, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { notifySubscriptionActivated } from './subscription-notifications';
import { calculateStackedSubscriptionCredit } from './subscription-stack';
import { applyProSubscriptionWindowToPrefs } from '@/lib/services/internal/subscription-prefs-merge';
import { assertEmailIsBillingAdmin } from '@/lib/services/internal/admin-guard';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUB_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
const ACTIVITY_LOG_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG;
const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROFILES_COLLECTION_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

export class SubscriptionService {
  /**
   * Ledger + prefs aligned Pro grant (admin-only). Requires ADMINS-listed actor email.
   */
  private async writeProSubscriptionDocument(
    targetUserId: string,
    planId: string,
    months: number,
    ratio = 1,
  ) {
    const { databases, users } = createAdminClient();

    const { currentPeriodStart, currentPeriodEnd } = await calculateStackedSubscriptionCredit(
      databases,
      targetUserId,
      planId,
      months,
      ratio,
    );

    const subData = {
      userId: targetUserId,
      plan: 'pro',
      status: 'active',
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      seats: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await databases.createDocument(NOTE_DB_ID, SUB_COLLECTION_ID, ID.unique(), subData, [
      Permission.read(Role.user(targetUserId)),
    ]);

    try {
      const prefs = (await users.getPrefs(targetUserId)) as Record<string, unknown>;
      await users.updatePrefs(targetUserId, applyProSubscriptionWindowToPrefs(prefs, currentPeriodEnd.toISOString()));
    } catch (err) {
      console.warn('[SubscriptionService] Failed to update user prefs:', err);
    }

    try {
      const profileRes = await databases.listDocuments(CHAT_DB_ID, PROFILES_COLLECTION_ID, [
        Query.equal('userId', targetUserId),
        Query.limit(2),
      ]);
      if (profileRes.total > 0) {
        await databases.updateDocument(CHAT_DB_ID, PROFILES_COLLECTION_ID, profileRes.documents[0].$id, {
          tier: 'PRO',
        });
      }
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
    durationMonths = 12,
  ) {
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
      bodyCopy: 'Your Pro subscription has been activated by the Accounts team.',
    }).catch((error) => {
      console.warn('[SubscriptionService] Failed to send manual activation email:', error);
    });

    const { databases } = createAdminClient();
    try {
      await databases.createDocument(NOTE_DB_ID, ACTIVITY_LOG_COLLECTION_ID, ID.unique(), {
        userId: actorUserId,
        action: 'MANUAL_ENABLE_PRO',
        targetType: 'subscription',
        targetId: targetUserId,
        details: JSON.stringify({
          reason: trimmedReason,
          actorEmail,
          durationMonths: months,
        }),
        timestamp: new Date().toISOString(),
      });
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
        bodyCopy: `Your account has been granted Pro access through the ${cat} program.`,
      }).catch((error) => {
        console.warn('[SubscriptionService] Failed to send category access email:', error);
      });
    }

    const { databases } = createAdminClient();
    try {
      await databases.createDocument(NOTE_DB_ID, ACTIVITY_LOG_COLLECTION_ID, ID.unique(), {
        userId: actorUserId,
        action: 'GRANT_CATEGORY_ACCESS',
        targetType: 'subscription_batch',
        targetId: 'BATCH',
        details: JSON.stringify({ category: cat, count: uniqueIds.length, actorEmail }),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SubscriptionService] Batch activity log skipped:', err);
    }
  }
}

export const subscriptionService = new SubscriptionService();
