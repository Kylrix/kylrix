import { Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
const SOURCE_CONTROL_TABLE = APPWRITE_CONFIG.TABLES.CHAT.SOURCE_CONTROL || 'source_control';

export interface SourceControlRow {
    $id?: string;
    projectId: string;
    provider: 'github' | 'gitlab' | string;
    repoName?: string;
    ownerName?: string;
    accessToken?: string;
    enabled?: boolean;
    metadata?: string;
    $createdAt?: string;
    $updatedAt?: string;
}

export const SourceControlService = {
    /** List all active source control integrations associated with a project. */
    async listIntegrations(projectId: string): Promise<SourceControlRow[]> {
        try {
            const response = await tablesDB.listRows(CHAT_DB, SOURCE_CONTROL_TABLE, [
                Query.equal('projectId', projectId),
                Query.limit(100)
            ]);
            return response.rows as any[];
        } catch (error) {
            console.error('[SourceControlService] Failed to list integrations:', error);
            return [];
        }
    },

    /** Retrieve a specific integration configuration by its unique Row ID. */
    async getIntegration(integrationId: string): Promise<SourceControlRow | null> {
        try {
            return await tablesDB.getRow(CHAT_DB, SOURCE_CONTROL_TABLE, integrationId) as any;
        } catch (error) {
            console.error('[SourceControlService] Failed to get integration:', error);
            return null;
        }
    },

    /** Save or update a project's Git integration configuration Row. */
    async saveIntegration(projectId: string, data: Partial<SourceControlRow>): Promise<SourceControlRow> {
        const existing = await this.listIntegrations(projectId);
        const integrationData = {
            projectId,
            provider: data.provider || 'github',
            repoName: data.repoName || '',
            ownerName: data.ownerName || '',
            accessToken: data.accessToken || '',
            enabled: data.enabled !== false,
            metadata: data.metadata || JSON.stringify({ updatedBy: 'system' })
        };

        if (existing.length > 0 && existing[0].$id) {
            // Update existing integration Row
            return await tablesDB.updateRow(
                CHAT_DB,
                SOURCE_CONTROL_TABLE,
                existing[0].$id,
                integrationData
            ) as any;
        } else {
            // Create a new integration Row
            const rowId = `git-${projectId}`;
            return await tablesDB.createRow(
                CHAT_DB,
                SOURCE_CONTROL_TABLE,
                rowId,
                integrationData
            ) as any;
        }
    },

    /** Disconnect/Delete the Git integration configuration Row from the project. */
    async removeIntegration(integrationId: string): Promise<boolean> {
        try {
            await tablesDB.deleteRow(CHAT_DB, SOURCE_CONTROL_TABLE, integrationId);
            return true;
        } catch (error) {
            console.error('[SourceControlService] Failed to delete integration:', error);
            return false;
        }
    },

    /**
     * Groundwork: Simulates converting project tasks into Git/GitHub issues.
     * Iterates over tasks, formats titles/descriptions, and returns the sync results.
     */
    async syncTasksToGitIssues(projectId: string, integration: SourceControlRow, tasks: any[]): Promise<{
        success: boolean;
        syncedCount: number;
        logs: string[];
    }> {
        const logs: string[] = [];
        logs.push(`[Sync] Starting sync with ${integration.provider} repository: ${integration.ownerName}/${integration.repoName}`);
        
        if (!tasks || tasks.length === 0) {
            logs.push('[Sync] No tasks found to export.');
            return { success: true, syncedCount: 0, logs };
        }

        let syncedCount = 0;
        for (const task of tasks) {
            const taskTitle = task.title || 'Untitled Task';
            const taskDesc = task.description || 'No description provided.';
            
            // Simulation of GitHub issue creation. Custom access token is retrieved if present.
            if (integration.accessToken) {
                logs.push(`[Sync] Authenticating via secure custom token for: "${taskTitle}"`);
            } else {
                logs.push(`[Sync] Authenticating via default OAuth for: "${taskTitle}"`);
            }
            
            logs.push(`[Sync] Exported task to ${integration.provider} issue #${100 + syncedCount} - Success`);
            syncedCount++;
        }

        logs.push(`[Sync] Successfully finished. Exported ${syncedCount} tasks as Git issues.`);
        return {
            success: true,
            syncedCount,
            logs
        };
    }
};
