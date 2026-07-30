export type AttachmentVisualKind = 'image' | 'pdf' | 'video' | 'audio' | 'link' | 'document' | 'icon';

export function inferAttachmentMimeType(
  label?: string | null,
  metadata?: Record<string, unknown> | null,
  childKind?: string): string {
  const fromMeta = metadata?.mimeType;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  const name = String(label || '').trim();
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
  const extMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    txt: 'text/plain',
    md: 'text/markdown'};
  if (ext && extMap[ext]) return extMap[ext];
  if (childKind === 'image') return 'image/jpeg';
  if (childKind === 'voice') return 'audio/webm';
  return 'application/octet-stream';
}

export function resolveAttachmentVisualKind(
  mimeType: string,
  childKind?: string,
  label?: string | null): AttachmentVisualKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = String(label || '').split('.').pop()?.toLowerCase() || '';

  if (childKind === 'link') return 'link';
  if (childKind === 'voice' || mime.startsWith('audio/')) return 'audio';
  if (childKind === 'image' || mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)
  ) {
    return 'document';
  }
  return 'icon';
}

export function linkHostname(href?: string | null): string {
  if (!href) return '';
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}
