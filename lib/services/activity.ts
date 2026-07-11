import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getNamedListCache } from './list-cache';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const ACTIVITY_TABLE = APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY;

export interface AppActivity {
    userId: string;
    appId: 'kylrixnote' | 'kylrixflow' | 'kylrixvault' | 'id' | 'connect';
    action: string;
    metadata?: Record<string, any>;
    timestamp?: string;
}

type LiveCallActivity = {
    t: 'call';
    id: string;
    src?: 'connect' | 'note' | 'flow' | 'space';
    s?: 'live' | 'ended';
};

const presenceCache = getNamedListCache<any | null>('presence', 15000); // 15s for presence
const activityCache = getNamedListCache<any>('activity', 30000);

/**
 * ActivityService: The "Nervous System" of the Kylrix Ecosystem.
 * Orchestrates cross-app synergies by observing and reacting to user actions.
 */
export const ActivityService = {
    /**
     * Presence Management
     */
    async updatePresence(userId: string, status: 'online' | 'offline' | 'away' | 'busy', customStatus?: string) {
        try {
            const safeStatus = customStatus ? customStatus.slice(0, 128) : undefined;
            // Check if presence record exists
            const existing = await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
                Query.equal('userId', userId),
                Query.orderDesc('$updatedAt'),
                Query.limit(1)
            ]);

            // const now = new Date().toISOString();
            let result;
            if (existing.total > 0) {
                result = await tablesDB.updateRow(DB_ID, ACTIVITY_TABLE, existing.rows[0].$id, {
                    status,
                    customStatus: safeStatus,
                    lastSeen: new Date().toISOString()
                });
            } else {
                result = await tablesDB.createRow(DB_ID, ACTIVITY_TABLE, ID.unique(), {
                    userId,
                    status,
                    customStatus: safeStatus,
                    lastSeen: new Date().toISOString()
                });
            }
            presenceCache.invalidate();
            return result;
        } catch (error: unknown) {
            console.error('Failed to update presence:', error);
            throw error;
        }
    },

    async getUserPresence(userId: string, force = false) {
        return presenceCache.fetch(async () => {
            const result = await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
                Query.equal('userId', userId),
                Query.orderDesc('$updatedAt'),
                Query.limit(1)
            ]);
            return result.rows[0] || null;
        }, force);
    },

    async logActivity(activity: AppActivity) {
        const res = await this.updatePresence(activity.userId, 'online', activity.action);
        activityCache.invalidate();

        // Physically record anonymized telemetry and user activity via TelemetryService
        try {
            const { TelemetryService } = await import('./telemetry');
            // Priority engine: prioritize recording long-running actions, creations, or deletions
            const isPriorityAction = 
                activity.action.includes('create') || 
                activity.action.includes('delete') || 
                activity.action.includes('update') || 
                activity.action.includes('publish') ||
                activity.action.includes('sync') ||
                activity.action.includes('import');

            await TelemetryService.recordTelemetry({
                niche: activity.appId === 'kylrixnote' ? 'workspace' : activity.appId === 'kylrixflow' ? 'productivity' : activity.appId === 'kylrixvault' ? 'security' : 'system',
                app: activity.appId,
                action: activity.action,
                metadata: {
                    ...activity.metadata,
                    isPriorityAction,
                    timestamp: activity.timestamp || new Date().toISOString()
                }
            });

            await TelemetryService.recordActivity({
                userId: activity.userId,
                niche: activity.appId === 'kylrixnote' ? 'workspace' : activity.appId === 'kylrixflow' ? 'productivity' : activity.appId === 'kylrixvault' ? 'security' : 'system',
                app: activity.appId,
                action: activity.action,
                metadata: {
                    ...activity.metadata,
                    isPriorityAction,
                    timestamp: activity.timestamp || new Date().toISOString()
                }
            });
        } catch (e) {
            console.error('[ActivityService] Failed to record telemetry background logs:', e);
        }

        return res;
    },

    /**
     * Get recent activities to identify "Logical Synergies".
     * This is where the "creepy but useful" work begins.
     */
    async getRecentActivity(userId: string, limit = 50, force = false) {
        return activityCache.fetch(async () => {
            return await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
                Query.equal('userId', userId),
                Query.orderDesc('$createdAt'),
                Query.limit(limit)
            ]);
        }, force);
    },

    /**
     * The Synergy Engine: Analyzes recent activity to suggest transitions.
     * e.g. If user is researching "Stripe" in Notes, suggest the "Payment" project in Flow.
     */
    async analyzeSynergy(userId: string) {
        const result = await this.getRecentActivity(userId);
        const activities = result.rows;

        // Logic for "Contextual Awareness"
        // 1. Analyze Note tags/content from most recent activities
        // 2. Cross-reference with Flow tasks
        // 3. Trigger local notifications via Connect

        return activities; // Placeholder for actual analysis logic
    },

    async setLiveCallActivity(userId: string, callId: string, source: LiveCallActivity['src'] = 'connect') {
        const payload: LiveCallActivity = {
            t: 'call',
            id: callId,
            src: source,
            s: 'live',
        };
        return this.updatePresence(userId, 'busy', JSON.stringify(payload));
    },

    async clearLiveCallActivity(userId: string) {
        return this.updatePresence(userId, 'online', undefined);
    },
};
