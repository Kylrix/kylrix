import {
  parseObjectBlocks,
  serializeObjectBlock,
  type SecondaryObjectPayload,
} from '@/lib/note-object-secondary';

export type ChatPendingObject = {
  block: string;
  payload: SecondaryObjectPayload;
};

export function parseChatAttachFile(file: any): ChatPendingObject | null {
  if (!file) return null;

  if (typeof file.fileUrl === 'string' && file.fileUrl.startsWith('[[kylrix-object:')) {
    const blocks = parseObjectBlocks(file.fileUrl);
    if (blocks[0]) {
      return { block: blocks[0].raw, payload: blocks[0].payload };
    }
  }

  const childId = String(file.$id || file.id || '').trim();
  if (!childId) return null;

  const mime = String(file.mimeType || '');
  const childKind: SecondaryObjectPayload['childKind'] = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('audio/')
      ? 'voice'
      : 'file';
  const bucketId = file.bucketId || 'notes_attachments';
  const payload: SecondaryObjectPayload = {
    childId,
    childKind,
    bucketId,
    label: file.name || file.title || file.label || 'Attachment',
    appTheme: 'connect',
    metadata: {
      mimeType: mime || undefined,
      fileName: file.name,
      subTab: file.bucketId,
    },
  };

  return { block: serializeObjectBlock(payload), payload };
}

export function composeChatMessageText(text: string, pending?: ChatPendingObject | null): string {
  const trimmed = text.trim();
  if (!pending?.block) return trimmed;
  return trimmed ? `${pending.block}\n\n${trimmed}` : pending.block;
}
