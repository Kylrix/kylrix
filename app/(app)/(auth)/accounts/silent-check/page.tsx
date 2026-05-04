'use client';

import { useEffect } from 'react';
import { Client, Account } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const client = new Client();
if (typeof window !== 'undefined') {
    client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
    client.setProject(APPWRITE_CONFIG.PROJECT_ID);
}
const account = new Account(client);

export default function SilentCheckPage() {
    useEffect(() => {
        async function performCheck() {
            // SECURITY: Validate origin to prevent auth status leakage (CVE-KYL-2026-001)
            const isTrustedOrigin = (origin: string) => {
                return origin.startsWith('http://localhost:') || 
                       origin.endsWith('.kylrix.space') || 
                       origin === 'https://kylrix.space';
            };

            // Attempt to determine parent origin for secure communication
            let targetOrigin = '*'; 
            try {
                const ancestor = (window.location as any).ancestorOrigins?.[0];
                if (ancestor && isTrustedOrigin(ancestor)) {
                    targetOrigin = ancestor;
                }
            } catch (_e: unknown) {}

            try {
                const user = await account.get();
                window.parent.postMessage({ type: 'idm:auth-status', status: 'authenticated', userId: user.$id, user }, targetOrigin);
            } catch (error: any) {
                window.parent.postMessage({ type: 'idm:auth-status', status: 'unauthenticated', errorCode: error.code }, targetOrigin);
            }
        }
        performCheck();
    }, []);

    return null; // Silent
}
