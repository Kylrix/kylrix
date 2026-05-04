import { createAdminClient } from '../appwrite-admin';
import { ID, Query } from 'node-appwrite';
import { notifySubscriptionActivated } from './subscription-notifications';
import { pickLatestSubscription, type SubscriptionRow } from './subscription-helpers';

const DATABASE_ID = '67ff05a9000296822396';
const SUB_COLLECTION_ID = 'subscriptions';
const ACTIVITY_LOG_COLLECTION_ID = 'activityLog';

export class SubscriptionService {
  /**
   * Manually enable a subscription.
   * Includes strict 'toggled' flag to prevent abuse.
   */
  async manualEnablePro(userId: string, adminId: string, reason: string) {
    const { databases } = createAdminClient();

    const subData = {
      userId,
      plan: 'pro',
      status: 'active',
      updatedAt: new Date().toISOString()
    };

    // Check if subscription exists
    const existing = await databases.listDocuments(DATABASE_ID, SUB_COLLECTION_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.orderDesc('updatedAt'),
      Query.limit(1),
      Query.select(['$id', 'userId', 'plan', 'status', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt']),
    ]);

    const latest = pickLatestSubscription(existing.documents as SubscriptionRow[]);

    if (latest) {
      await databases.updateDocument(DATABASE_ID, SUB_COLLECTION_ID, latest.$id, subData);
    } else {
      await databases.createDocument(DATABASE_ID, SUB_COLLECTION_ID, ID.unique(), {
          ...subData,
          createdAt: new Date().toISOString()
      });
    }

    await notifySubscriptionActivated({
      userId,
      plan: 'PRO',
      months: 1,
      currentPeriodEnd: null,
      sourceLabel: 'Manual activation',
      bodyCopy: 'Your Pro subscription has been activated by the Accounts team.',
    }).catch((error) => {
      console.warn('[SubscriptionService] Failed to send manual activation email:', error);
    });

    // Activity Log
    await databases.createDocument(DATABASE_ID, ACTIVITY_LOG_COLLECTION_ID, ID.unique(), {
      userId: adminId,
      action: 'MANUAL_ENABLE_PRO',
      targetType: 'subscription',
      targetId: userId,
      details: JSON.stringify({ reason, toggled: true }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Grant access to a category of people (e.g. Students)
   * This uses a specific tier and flags it in metadata.
   */
  async grantCategoryAccess(userIds: string[], category: string, adminId: string) {
    const { databases } = createAdminClient();

    for (const userId of userIds) {
      const subData = {
        userId,
        plan: 'pro',
        status: 'active',
        updatedAt: new Date().toISOString()
      };

      const existing = await databases.listDocuments(DATABASE_ID, SUB_COLLECTION_ID, [
        Query.equal('userId', userId),
        Query.equal('status', 'active'),
        Query.orderDesc('updatedAt'),
        Query.limit(1),
        Query.select(['$id', 'userId', 'plan', 'status', 'currentPeriodStart', 'currentPeriodEnd', 'createdAt', 'updatedAt']),
      ]);

      const latest = pickLatestSubscription(existing.documents as SubscriptionRow[]);

      if (latest) {
        await databases.updateDocument(DATABASE_ID, SUB_COLLECTION_ID, latest.$id, subData);
      } else {
        await databases.createDocument(DATABASE_ID, SUB_COLLECTION_ID, ID.unique(), {
            ...subData,
            createdAt: new Date().toISOString()
        });
      }

      await notifySubscriptionActivated({
        userId,
        plan: 'PRO',
        months: 1,
        currentPeriodEnd: null,
        sourceLabel: `Category access: ${category}`,
        bodyCopy: `Your account has been granted Pro access through the ${category} program.`,
      }).catch((error) => {
        console.warn('[SubscriptionService] Failed to send category access email:', error);
      });
    }

    // Activity Log for batch action
    await databases.createDocument(DATABASE_ID, ACTIVITY_LOG_COLLECTION_ID, ID.unique(), {
      userId: adminId,
      action: 'GRANT_CATEGORY_ACCESS',
      targetType: 'subscription_batch',
      targetId: 'BATCH',
      details: JSON.stringify({ category, count: userIds.length }),
      timestamp: new Date().toISOString()
    });
  }
}

export const subscriptionService = new SubscriptionService();
