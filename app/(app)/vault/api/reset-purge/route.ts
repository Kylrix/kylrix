import { NextRequest, NextResponse } from 'next/server';
import { AppwriteService, resolveCurrentUser, appwriteDatabases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

/**
 * MASTER PURGE: Wipes all Tier 2 (Zero-Knowledge) data for a user.
 * Triggered upon Master Password Reset.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await resolveCurrentUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = user.$id;
        console.log(`[MasterPurge] Starting Tier 2 purge for user: ${userId}`);

        // 1. Purge Vault Tier 2 Data (Credentials, TOTP Secrets)
        // We list all and delete.
        const creds = await AppwriteService.listAllCredentials(userId);
        const totps = await AppwriteService.listTOTPSecrets(userId);

        console.log(`[MasterPurge] Deleting ${creds.length} credentials and ${totps.length} TOTP secrets`);

        await Promise.all([
            ...creds.map(c => AppwriteService.deleteCredential(c.$id)),
            ...totps.map(t => AppwriteService.deleteTOTPSecret(t.$id))
        ]);

        // 2. Purge Connect Tier 2 Data (Direct Messages ONLY)
        // We identify Direct conversations and wipe footprints. 
        // Group chats are PRESERVED so the user doesn't lose access to communities.
        const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
        const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
        const CONV_MEMBERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS || 'conversationMembers';
        const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
        
        const memberRows = await appwriteDatabases.listDocuments(CHAT_DB, CONV_MEMBERS_TABLE, [
            Query.equal('userId', userId),
            Query.limit(1000)
        ]);
        const conversationIds = Array.from(new Set((memberRows.documents || []).map((row: any) => row.conversationId).filter(Boolean)));
        const convsRes = conversationIds.length ? await appwriteDatabases.listDocuments(CHAT_DB, CONV_TABLE, [
            Query.equal('$id', conversationIds),
            Query.equal('type', 'direct')
        ]) : { documents: [] as any[], total: 0 };

        console.log(`[MasterPurge] Found ${convsRes.total} direct conversations to purge`);

        for (const conv of convsRes.documents) {
            // Check if it's a self-chat (all participants are the user)
            const isSelfChat = conv.participants.every((p: string) => p === userId);
            
            const msgsRes = await appwriteDatabases.listDocuments(CHAT_DB, MSG_TABLE, [
                Query.equal('conversationId', conv.$id),
                Query.equal('senderId', userId),
                Query.limit(1000)
            ]);
            
            await Promise.all(msgsRes.documents.map(m => appwriteDatabases.deleteDocument(CHAT_DB, MSG_TABLE, m.$id)));

            // If it was a self-chat, we can just delete the conversation too as it's purely Tier 2
            if (isSelfChat) {
                await appwriteDatabases.deleteDocument(CHAT_DB, CONV_TABLE, conv.$id);
            }
        }

        // 3. Purge Keychain (Passwords, Passkeys, and the E2E Identity)
        // We wipe the actual keys, but we'll update the Chat User identity instead of deleting it
        // to prevent breaking group chat participant references.
        const keychainEntries = await AppwriteService.listKeychainEntries(userId);
        console.log(`[MasterPurge] Purging ${keychainEntries.length} keychain entries`);
        
        await Promise.all(keychainEntries.map(e => AppwriteService.deleteKeychainEntry(e.$id)));

        const identityRows = await appwriteDatabases.listDocuments(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
            [Query.equal('userId', userId)]
        );
        await Promise.all(identityRows.documents.map(row => appwriteDatabases.deleteDocument(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
            row.$id
        )));

        const keyMappings = await appwriteDatabases.listDocuments(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'key_mapping',
            [
                Query.or([
                    Query.equal('grantee', userId),
                    Query.contains('metadata', userId),
                    Query.equal('resourceId', userId),
                ])
            ]
        );
        await Promise.all(keyMappings.documents.map(row => appwriteDatabases.deleteDocument(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'key_mapping',
            row.$id
        )));

        // 4. Reset profile public keys (Clear public key so others know it's stale)
        const CHAT_USERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.USERS;
        const NOTE_USERS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.USERS;
        try {
            await Promise.all([
                appwriteDatabases.updateDocument(CHAT_DB, CHAT_USERS_TABLE, userId, {
                    publicKey: null,
                    updatedAt: new Date().toISOString()
                }).catch(() => null),
                appwriteDatabases.updateDocument(APPWRITE_CONFIG.DATABASES.NOTE, NOTE_USERS_TABLE, userId, {
                    publicKey: null,
                    updatedAt: new Date().toISOString()
                }).catch(() => null),
            ]);
            console.log(`[MasterPurge] Reset profile public keys for user: ${userId}`);
        } catch (e) {
            console.warn(`[MasterPurge] Could not reset profile keys (might not exist yet):`, e);
        }

        // 4. Update User Doc (Clear masterpass flag)
        const userDoc = await AppwriteService.getUserDoc(userId);
        if (userDoc) {
            await AppwriteService.updateUserDoc(userDoc.$id, { 
                masterpass: false,
                isPasskey: false 
            });
        }

        console.log(`[MasterPurge] Purge complete for user: ${userId}`);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[MasterPurge] Critical failure:', error);
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
