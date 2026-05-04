import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const ACTIVITY_TABLE = APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY;

export interface AppActivity {
    userId: string;
    appId: 'kylrixnote' | 'kylrixflow' | 'kylrixvault' | 'id' | 'connect';
    action: string;
    metadata?: Record<string, any>;
    timestamp?: string;
}

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
            // Check if presence record exists
            const existing = await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
                Query.equal('userId', userId),
                Query.limit(1)
            ]);

            // const now = new Date().toISOString();
            if (existing.total > 0) {
                return await tablesDB.updateRow(DB_ID, ACTIVITY_TABLE, existing.rows[0].$id, {
                    status,
                    customStatus,
                    lastSeen: new Date().toISOString()
                });
            } else {
                return await tablesDB.createRow(DB_ID, ACTIVITY_TABLE, ID.unique(), {
                    userId,
                    status,
                    customStatus,
                    lastSeen: new Date().toISOString()
                });
            }
        } catch (error: unknown) {
            console.error('Failed to update presence:', error);
        }
    },

    async getUserPresence(userId: string) {
        const result = await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
            Query.equal('userId', userId),
            Query.limit(1)
        ]);
        return result.rows[0] || null;
    },

    /**
     * Log an activity from any app in the ecosystem.
     */
    async logActivity(activity: AppActivity) {
        // Here we might use a different table if 'AppActivity' is overloaded for presence.
        // But based on the schema I saw earlier (userId, status, lastSeen, customStatus), 
        // it seems AppActivity is primarily for presence. 
        // If there's another table for logs, we'd use that.
        // Let's assume for now AppActivity IS the presence table.
        return this.updatePresence(activity.userId, 'online', activity.action);
    },

    /**
     * Get recent activities to identify "Logical Synergies".
     * This is where the "creepy but useful" work begins.
     */
    async getRecentActivity(userId: string, limit = 50) {
        return await tablesDB.listRows(DB_ID, ACTIVITY_TABLE, [
            Query.equal('userId', userId),
            Query.orderDesc('$createdAt'),
            Query.limit(limit)
        ]);
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
    }
};
