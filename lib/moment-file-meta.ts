/**
 * Parses `moment.fileId` JSON (Connect metadata). No Appwrite deps — safe for server + client.
 */
export function getNoteAttachmentIdFromMomentFileId(fileId: unknown): string | null {
  if (!fileId || typeof fileId !== 'string') return null;
  if (!fileId.startsWith('{')) return null;
  try {
    const meta = JSON.parse(fileId) as { attachments?: { type?: string; id?: string }[] };
    const atts = meta?.attachments;
    if (!Array.isArray(atts)) return null;
    const hit = atts.find((a) => a?.type === 'note' && a?.id);
    return hit?.id ? String(hit.id).trim() : null;
  } catch {
    return null;
  }
}
