'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  FileText,
  File as FileIcon,
  Link2,
  StickyNote,
  ListTodo,
  ClipboardList,
  Shield,
} from 'lucide-react';
import { Box, Typography, alpha } from '@/lib/openbricks/primitives';
import { isEphemeralComposeNoteId } from '@/lib/notes/compose-draft-registry';
import { preProcessMarkdown } from '@/lib/markdown';
import { VoiceNotePlayer } from '@/components/LinkRenderer';
import { parseObjectBlocks, type SecondaryObjectPayload } from '@/lib/note-object-secondary';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { StorageService } from '@/lib/services/storage';
import { getNoteInheritedFileBlob, getNoteSecondaryObjectPreview } from '@/lib/actions/client-ops';
import {
  fetchNoteObjectPreviewCached,
  noteObjectPreviewCacheKey,
  readCachedNoteObjectPreview,
  writeCachedNoteObjectPreview,
  type NoteObjectPreviewResult,
} from '@/lib/note-object-preview-cache';
import {
  inferAttachmentMimeType,
  linkHostname,
  resolveAttachmentVisualKind,
  type AttachmentVisualKind,
} from '@/lib/note-object-visual';

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface NoteContentRendererProps {
  content?: string | null;
  format?: string | null;
  emptyFallback?: React.ReactNode;
  preview?: boolean;
  primaryNoteId?: string;
}

function isEphemeralNoteId(noteId?: string) {
  return !noteId || noteId.startsWith('ghost-') || isEphemeralComposeNoteId(noteId);
}

export function NoteContentRenderer({
  content,
  format = 'text',
  emptyFallback = <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.3)' }}>This note is empty.</Typography>,
  primaryNoteId,
}: NoteContentRendererProps) {
  const objectBlocks = useMemo(() => {
    const blocks = parseObjectBlocks(content || '');
    if (!blocks.length) return [{ type: 'text' as const, content: (content || '').trim() }];

    const nodes: Array<{ type: 'text'; content: string } | { type: 'object'; payload: SecondaryObjectPayload }> = [];
    let cursor = 0;
    const source = content || '';
    for (const block of blocks) {
      if (cursor < block.start) {
        nodes.push({ type: 'text', content: source.slice(cursor, block.start) });
      }
      nodes.push({ type: 'object', payload: block.payload });
      cursor = block.end;
    }
    if (cursor < source.length) {
      nodes.push({ type: 'text', content: source.slice(cursor) });
    }
    return nodes;
  }, [content]);

  const parts = useMemo(() => {
    const trimmed = content?.trim();
    if (!trimmed) return [];
    const voiceNoteRegex = /(\[voice:[a-zA-Z0-9_-]+\])/g;
    return trimmed.split(voiceNoteRegex);
  }, [content]);

  if (format === 'doodle') {
    return (
      <Box>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.3)' }}>
          Sketch notes are no longer supported. Create a new text note to continue.
        </Typography>
      </Box>
    );
  }

  if (parts.length === 0) {
    return <Box>{emptyFallback}</Box>;
  }

  const renderMarkdownText = (text: string, keyPrefix: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const voiceNoteRegex = /(\[voice:[a-zA-Z0-9_-]+\])/g;
    const voiceParts = trimmed.split(voiceNoteRegex);
    return voiceParts.map((part, index) => {
      const match = part.match(/^\[voice:([a-zA-Z0-9_-]+)\]$/);
      if (match) {
        const fileId = match[1];
        return (
          <Box key={`${keyPrefix}-voice-${index}`} sx={{ my: 1.5, display: 'block' }} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <VoiceNotePlayer fileId={fileId} />
          </Box>
        );
      }
      const processed = preProcessMarkdown(part);
      const rawHtml = marked.parse(processed) as string;
      const sanitizedHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
      return (
        <Box
          key={`${keyPrefix}-text-${index}`}
          component="div"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          sx={{ display: 'inline' }}
        />
      );
    });
  };

  return (
    <Box
      sx={{
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '1.125rem',
        lineHeight: 1.75,
        '& p': { mb: 3 },
        '& h1': { fontSize: '2.25rem', fontWeight: 900, mb: 4, mt: 4, color: 'white', letterSpacing: '-0.02em' },
        '& h2': { fontSize: '1.875rem', fontWeight: 800, mb: 3, mt: 4, color: 'white', letterSpacing: '-0.01em' },
        '& h3': { fontSize: '1.5rem', fontWeight: 700, mb: 2, mt: 3, color: 'white' },
        '& ul, & ol': { mb: 3, pl: 4 },
        '& li': { mb: 1 },
        '& blockquote': {
          borderLeft: '4px solid #6366F1',
          pl: 3,
          py: 1,
          my: 4,
          bgcolor: alpha('#6366F1', 0.05),
          borderRadius: '0 12px 12px 0',
          fontStyle: 'italic',
          color: 'rgba(255, 255, 255, 0.8)',
        },
        '& code': {
          bgcolor: 'rgba(255, 255, 255, 0.1)',
          px: 1,
          py: 0.5,
          borderRadius: '6px',
          fontSize: '0.9em',
          fontFamily: 'monospace',
          color: '#6366F1',
        },
        '& pre': {
          bgcolor: 'rgba(0, 0, 0, 0.3)',
          p: 3,
          borderRadius: '16px',
          overflowX: 'auto',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          my: 4,
          '& code': { bgcolor: 'transparent', p: 0, color: 'inherit' },
        },
        '& img': { maxWidth: '100%', borderRadius: '16px', my: 4 },
        '& hr': { border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.1)', my: 6 },
        '& a': {
          color: '#6366F1',
          textDecoration: 'none',
          fontWeight: 600,
          borderBottom: '1px solid transparent',
          transition: 'all 0.2s ease',
          '&:hover': { borderBottomColor: '#6366F1' },
        },
      }}
    >
      {objectBlocks.map((node, index) => {
        if (node.type === 'text') {
          return <React.Fragment key={`node-${index}`}>{renderMarkdownText(node.content, `node-${index}`)}</React.Fragment>;
        }
        return (
          <SecondaryObjectShell
            key={`obj-${primaryNoteId || 'note'}-${node.payload.childKind}-${node.payload.childId}`}
            payload={node.payload}
            primaryNoteId={primaryNoteId}
          />
        );
      })}
    </Box>
  );
}

function SecondaryObjectShell({
  payload,
  primaryNoteId,
}: {
  payload: SecondaryObjectPayload;
  primaryNoteId?: string;
}) {
  const bucketId = payload.bucketId || APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE;
  const mimeType = inferAttachmentMimeType(payload.label, payload.metadata, payload.childKind);
  const visualKind = resolveAttachmentVisualKind(mimeType, payload.childKind, payload.label);
  const cacheKey = primaryNoteId ? noteObjectPreviewCacheKey(primaryNoteId, payload) : '';

  const [preview, setPreview] = useState<NoteObjectPreviewResult | null>(null);
  const [directSrc, setDirectSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    let active = true;

    const loadClientDirectMedia = () => {
      try {
        if (visualKind === 'image') {
          setDirectSrc(StorageService.getFilePreview(payload.childId, bucketId, 960, 540).toString());
        } else if (visualKind === 'video' || visualKind === 'pdf') {
          setDirectSrc(StorageService.getFileView(payload.childId, bucketId).toString());
        }
        if (active) setStatus('ready');
      } catch {
        if (active) setStatus('ready');
      }
    };

    const cached = cacheKey ? readCachedNoteObjectPreview(cacheKey) : null;
    if (cached) {
      setPreview(cached);
      setStatus('ready');
      return () => {
        active = false;
      };
    }

    const load = async () => {
      if (!primaryNoteId || isEphemeralNoteId(primaryNoteId)) {
        if (payload.childKind === 'link') {
          if (active) setStatus('ready');
          return;
        }
        loadClientDirectMedia();
        return;
      }

      const result = await fetchNoteObjectPreviewCached(cacheKey, async () => {
        const res = await getNoteSecondaryObjectPreview({
          noteId: primaryNoteId,
          childKind: payload.childKind,
          childId: payload.childId,
          bucketId: payload.bucketId,
          label: payload.label,
          href: payload.href,
          mimeType: typeof payload.metadata?.mimeType === 'string' ? payload.metadata.mimeType : undefined,
        });
        return {
          ok: res.ok,
          title: res.ok ? res.title : payload.label,
          href: res.ok ? res.href : payload.href,
          previewDataUrl: res.ok ? res.previewDataUrl : null,
          childKind: res.ok ? res.childKind : payload.childKind,
          bucketId: res.ok ? res.bucketId : bucketId,
          fileId: res.ok ? res.fileId : payload.childId,
          mimeType: res.ok ? res.mimeType : mimeType,
          visualKind: res.ok ? res.visualKind : visualKind,
        };
      });

      if (!active) return;

      if (result.previewDataUrl) {
        setPreview(result);
        setStatus('ready');
        return;
      }

      const needsMedia = visualKind === 'image' || visualKind === 'video' || visualKind === 'pdf' || visualKind === 'audio';
      if (needsMedia && primaryNoteId && !isEphemeralNoteId(primaryNoteId)) {
        try {
          const blob = await getNoteInheritedFileBlob(primaryNoteId, payload.childId, bucketId);
          const enriched: NoteObjectPreviewResult = {
            ...result,
            ok: true,
            previewDataUrl: blob.dataUrl,
            mimeType: blob.mimeType,
          };
          writeCachedNoteObjectPreview(cacheKey, enriched);
          setPreview(enriched);
          setStatus('ready');
          return;
        } catch {
          // fall through to client URLs
        }
      }

      setPreview(result);
      if (visualKind === 'image' || visualKind === 'video' || visualKind === 'pdf') {
        loadClientDirectMedia();
        return;
      }

      setStatus('ready');
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    primaryNoteId,
    cacheKey,
    payload.childId,
    payload.childKind,
    payload.bucketId,
    payload.label,
    payload.href,
    payload.metadata,
    bucketId,
    mimeType,
    visualKind,
  ]);

  const resolvedVisual = (preview?.visualKind as AttachmentVisualKind | undefined) || visualKind;
  const mediaSrc = preview?.previewDataUrl || directSrc;
  const href = preview?.href || payload.href || (payload.childKind === 'link' ? payload.childId : null);
  const themeColor = payload.appTheme === 'vault' ? '#10B981' : payload.appTheme === 'flow' ? '#22C55E' : '#6366F1';

  return (
    <Box sx={{ my: 2, borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
      {status === 'loading' ? (
        <Box sx={{ p: 3, color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Loading attachment…</Box>
      ) : (
        <AttachmentVisual
          visualKind={resolvedVisual}
          mediaSrc={mediaSrc}
          href={href}
          label={payload.label}
          childKind={payload.childKind}
          themeColor={themeColor}
          primaryNoteId={primaryNoteId}
          fileId={payload.childId}
          bucketId={bucketId}
        />
      )}
    </Box>
  );
}

function AttachmentVisual({
  visualKind,
  mediaSrc,
  href,
  label,
  childKind,
  themeColor,
  primaryNoteId,
  fileId,
  bucketId,
}: {
  visualKind: AttachmentVisualKind;
  mediaSrc: string | null;
  href: string | null;
  label?: string;
  childKind: string;
  themeColor: string;
  primaryNoteId?: string;
  fileId: string;
  bucketId: string;
}) {
  const [opening, setOpening] = useState(false);

  const openFile = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (primaryNoteId && !isEphemeralNoteId(primaryNoteId)) {
        const blob = await getNoteInheritedFileBlob(primaryNoteId, fileId, bucketId);
        const link = document.createElement('a');
        link.href = blob.dataUrl;
        link.download = blob.name || label || 'attachment';
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.click();
        return;
      }
      window.open(StorageService.getFileView(fileId, bucketId).toString(), '_blank', 'noopener,noreferrer');
    } finally {
      setOpening(false);
    }
  };

  if (visualKind === 'image') {
    if (!mediaSrc) {
      return <Box sx={{ p: 3, color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Loading image…</Box>;
    }
    return (
      <Box
        component="img"
        src={mediaSrc}
        alt={label || 'Attached image'}
        sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block', bgcolor: '#0B0A09' }}
      />
    );
  }

  if (visualKind === 'video') {
    if (!mediaSrc) {
      return <Box sx={{ p: 3, color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Loading video…</Box>;
    }
    return (
      <Box component="video" src={mediaSrc} controls playsInline sx={{ width: '100%', maxHeight: 420, display: 'block', bgcolor: '#000' }} />
    );
  }

  if (visualKind === 'audio' || childKind === 'voice') {
    return (
      <Box sx={{ p: 2 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {mediaSrc ? (
          <VoiceNotePlayer fileId={fileId} audioSrc={mediaSrc} />
        ) : primaryNoteId && !isEphemeralNoteId(primaryNoteId) ? (
          <InheritedVoiceLoader noteId={primaryNoteId} fileId={fileId} bucketId={bucketId} />
        ) : (
          <VoiceNotePlayer fileId={fileId} />
        )}
      </Box>
    );
  }

  if (visualKind === 'pdf') {
    if (!mediaSrc) {
      return <Box sx={{ p: 3, color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Loading PDF…</Box>;
    }
    return (
      <Box sx={{ width: '100%', height: 420, bgcolor: '#111' }}>
        <Box component="iframe" src={mediaSrc} title={label || 'PDF preview'} sx={{ width: '100%', height: '100%', border: 0 }} />
      </Box>
    );
  }

  if (visualKind === 'link' && href) {
    const host = linkHostname(href);
    return (
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          textDecoration: 'none',
          color: 'inherit',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        }}
      >
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {host ? (
            <Box component="img" src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" sx={{ width: 22, height: 22 }} />
          ) : (
            <Link2 size={20} color={themeColor} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {host || 'Link'}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {href}
          </Typography>
        </Box>
      </Box>
    );
  }

  const Icon = ecosystemIcon(childKind) || (visualKind === 'document' ? FileText : FileIcon);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 72, height: 72, borderRadius: '16px', bgcolor: `${themeColor}18`, display: 'grid', placeItems: 'center' }}>
        <Icon size={34} color={themeColor} strokeWidth={1.75} />
      </Box>
      {(visualKind === 'document' || visualKind === 'icon') && (
        <Box
          component="button"
          type="button"
          onClick={() => void openFile()}
          disabled={opening}
          sx={{
            px: 2.5,
            py: 1,
            borderRadius: '10px',
            border: `1px solid ${themeColor}55`,
            color: themeColor,
            fontSize: '0.8rem',
            fontWeight: 800,
            bgcolor: 'transparent',
            cursor: opening ? 'wait' : 'pointer',
          }}
        >
          {opening ? 'Opening…' : 'Open file'}
        </Box>
      )}
    </Box>
  );
}

function ecosystemIcon(childKind: string) {
  switch (childKind) {
    case 'task':
      return ListTodo;
    case 'form':
      return ClipboardList;
    case 'note':
      return StickyNote;
    case 'vault':
      return Shield;
    default:
      return null;
  }
}

function InheritedVoiceLoader({
  noteId,
  fileId,
  bucketId,
}: {
  noteId: string;
  fileId: string;
  bucketId: string;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const cacheKey = `blob:${noteId}:${fileId}:${bucketId}`;

  useEffect(() => {
    let active = true;
    const cached = readCachedNoteObjectPreview(cacheKey);
    if (cached?.previewDataUrl) {
      setAudioUrl(cached.previewDataUrl);
      return;
    }
    void getNoteInheritedFileBlob(noteId, fileId, bucketId)
      .then((blob) => {
        if (!active) return;
        writeCachedNoteObjectPreview(cacheKey, { ok: true, previewDataUrl: blob.dataUrl });
        setAudioUrl(blob.dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [noteId, fileId, bucketId, cacheKey]);

  if (!audioUrl) {
    return <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Loading audio…</Typography>;
  }
  return <VoiceNotePlayer fileId={fileId} audioSrc={audioUrl} />;
}

export default NoteContentRenderer;
