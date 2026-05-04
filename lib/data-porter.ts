/**
 * Data Porter Client
 * ------------------
 * Client-side SDK for the data-porter Appwrite Function.
 * Handles import/export operations with progress tracking and fallback.
 */

import { Functions, ExecutionMethod } from 'appwrite';
import { appwriteClient } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const functions = new Functions(appwriteClient);

// Function ID — must be set after deploying the function
const DATA_PORTER_FUNCTION_ID = APPWRITE_CONFIG.FUNCTIONS.DATA_PORTER || 'data-porter';

export interface PorterImportResult {
    success: boolean;
    summary: {
        foldersCreated: number;
        credentialsCreated: number;
        totpSecretsCreated: number;
        errors: number;
        skipped: number;
        skippedExisting: number;
    };
    errors: string[];
}

export interface PorterExportResult {
    success: boolean;
    data: {
        version: number;
        format: string;
        exportedAt: string;
        folders: any[];
        credentials: any[];
        totpSecrets: any[];
    };
}

/**
 * Import data via the server-side function (bypasses rate limits).
 */
export async function porterImport(
    userId: string,
    format: 'bitwarden' | 'kylrixvault',
    data: any
): Promise<PorterImportResult> {
    try {
        const execution = await functions.createExecution(
            DATA_PORTER_FUNCTION_ID,
            JSON.stringify({
                action: 'import',
                userId,
                format,
                data,
            }),
            false, // async = false (synchronous execution, we wait for result)
            '/', // path
            ExecutionMethod.POST // method
        );

        if (execution.status === 'failed') {
            throw new Error(execution.responseBody || 'Function execution failed');
        }

        const result = JSON.parse(execution.responseBody);
        return result;
    } catch (error: unknown) {
        console.error('[DataPorter] Import via function failed:', error);
        throw error;
    }
}

/**
 * Export entire vault via the server-side function.
 * Returns a JSON object that can be downloaded as a file.
 */
export async function porterExport(userId: string): Promise<PorterExportResult> {
    try {
        const execution = await functions.createExecution(
            DATA_PORTER_FUNCTION_ID,
            JSON.stringify({
                action: 'export',
                userId,
            }),
            false,
            '/',
            ExecutionMethod.POST
        );

        if (execution.status === 'failed') {
            throw new Error(execution.responseBody || 'Function execution failed');
        }

        const result = JSON.parse(execution.responseBody);
        return result;
    } catch (error: unknown) {
        console.error('[DataPorter] Export via function failed:', error);
        throw error;
    }
}

/**
 * Download export data as a JSON file.
 */
export function downloadExportAsFile(data: PorterExportResult['data'], filename?: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `kylrix-vault-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
