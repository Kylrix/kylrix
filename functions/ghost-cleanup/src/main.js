import { Client, Databases, Query, Storage } from 'node-appwrite';

/**
 * Ghost Cleanup Function
 * Schedule: Daily (0 0 * * *)
 * 
 * Recursively purges expired ghost notes, Send payloads, 
 * and associated binary storage files.
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);
    const storage = new Storage(client);

    const NOTE_DB = process.env.DATABASE_ID_NOTE || '67ff05a9000296822396';
    const NOTES_TABLE = process.env.TABLE_ID_NOTES || '67ff05f3002502ef239e';
    const COMMENTS_TABLE = 'comments';
    const REACTIONS_TABLE = 'reactions';
    const VAULT_DB = 'passwordManagerDb';
    const KEY_MAPPING_TABLE = 'key_mapping';
    const SEND_BUCKET = 'kylrix_send';

    try {
        log('Starting daily ghost cleanup sweep...');

        // 1. Find expired ghost notes
        // Criteria: No userId (guest), Public, and expired
        const expired = await databases.listDocuments(NOTE_DB, NOTES_TABLE, [
            Query.isNull('userId'),
            Query.equal('isPublic', true),
            Query.equal('isThread', false),
            Query.equal('isChat', false),
            Query.limit(100)
        ]);

        let deletedCount = 0;

        for (const doc of expired.documents) {
            let meta = {};
            try {
                meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata || {};
            } catch (e) {
                continue;
            }

            // Preservation check
            if (!meta.isGhost) continue;
            
            const exp = meta.expiresAt ? new Date(meta.expiresAt).getTime() : NaN;
            if (!Number.isFinite(exp) || exp > Date.now()) continue;

            log(`Purging expired ghost: ${doc.$id} (${meta.send_object?.kind || 'note'})`);

            // --- RECURSIVE CLEANUP ---

            // A. Cleanup Storage Files
            const sendObj = meta.send_object;
            if (sendObj?.kind === 'file' || doc.isFile === true) {
                const bucketId = sendObj?.bucketId || SEND_BUCKET;
                const fileId = sendObj?.fileId;
                if (bucketId && fileId) {
                    try {
                        await storage.deleteFile(bucketId, fileId);
                        log(`  - Deleted file ${fileId} from ${bucketId}`);
                    } catch (sErr) {
                        log(`  - Storage cleanup skipped: ${sErr.message}`);
                    }
                }
            }

            // B. Cleanup Comments (Messages)
            try {
                const comments = await databases.listDocuments(NOTE_DB, COMMENTS_TABLE, [
                    Query.equal('noteId', doc.$id),
                    Query.limit(500)
                ]);
                for (const c of comments.documents) {
                    // Check for voice notes in metadata
                    let cMeta = {};
                    try { cMeta = JSON.parse(c.metadata || '{}'); } catch {}
                    if (cMeta.voiceFileId) {
                        await storage.deleteFile('voice', cMeta.voiceFileId).catch(() => {});
                    }
                    await databases.deleteDocument(NOTE_DB, COMMENTS_TABLE, c.$id);
                }
                log(`  - Cleared ${comments.total} comments`);
            } catch (cErr) {
                log(`  - Comment cleanup skipped: ${cErr.message}`);
            }

            // C. Cleanup Vault Mappings
            try {
                const mappings = await databases.listDocuments(VAULT_DB, KEY_MAPPING_TABLE, [
                    Query.equal('resourceId', doc.$id),
                    Query.equal('resourceType', 'note'),
                    Query.limit(100)
                ]);
                for (const m of mappings.documents) {
                    await databases.deleteDocument(VAULT_DB, KEY_MAPPING_TABLE, m.$id);
                }
            } catch (mErr) {}

            // D. Final deletion of the note itself
            await databases.deleteDocument(NOTE_DB, NOTES_TABLE, doc.$id);
            deletedCount++;
        }

        log(`Cleanup complete. Deleted ${deletedCount} expired ghost objects.`);
        return res.json({ success: true, deleted: deletedCount });

    } catch (err) {
        error(`Ghost cleanup failed: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
