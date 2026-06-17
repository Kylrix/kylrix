'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Box, Typography, alpha } from '@/lib/mui-tailwind/material';
import { preProcessMarkdown } from '@/lib/markdown';
import { VoiceNotePlayer } from '@/components/LinkRenderer';

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface NoteContentRendererProps {
  content?: string | null;
  format?: string | null;
  emptyFallback?: React.ReactNode;
  preview?: boolean;
}

export function NoteContentRenderer({
  content,
  format = 'text',
  emptyFallback = <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.3)' }}>This note is empty.</Typography>,
}: NoteContentRendererProps) {
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

  return (
    <Box
      sx={{
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '1.125rem',
        lineHeight: 1.75,
        '& p': { mb: 3 },
        '& h1': {
          fontSize: '2.25rem',
          fontWeight: 900,
          mb: 4,
          mt: 4,
          color: 'white',
          letterSpacing: '-0.02em',
        },
        '& h2': {
          fontSize: '1.875rem',
          fontWeight: 800,
          mb: 3,
          mt: 4,
          color: 'white',
          letterSpacing: '-0.01em',
        },
        '& h3': {
          fontSize: '1.5rem',
          fontWeight: 700,
          mb: 2,
          mt: 3,
          color: 'white',
        },
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
          '& code': {
            bgcolor: 'transparent',
            p: 0,
            color: 'inherit',
          },
        },
        '& img': {
          maxWidth: '100%',
          borderRadius: '16px',
          my: 4,
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          my: 6,
        },
        '& a': {
          color: '#6366F1',
          textDecoration: 'none',
          fontWeight: 600,
          borderBottom: '1px solid transparent',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderBottomColor: '#6366F1',
          },
        },
      }}
    >
      {parts.map((part, index) => {
        const match = part.match(/^\[voice:([a-zA-Z0-9_-]+)\]$/);
        if (match) {
          const fileId = match[1];
          return (
            <Box key={index} sx={{ my: 1.5, display: 'block' }} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
              <VoiceNotePlayer fileId={fileId} />
            </Box>
          );
        }

        const processed = preProcessMarkdown(part);
        const rawHtml = marked.parse(processed) as string;
        const sanitizedHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;

        return (
          <Box
            key={index}
            component="div"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            sx={{ display: 'inline' }}
          />
        );
      })}
    </Box>
  );
}

export default NoteContentRenderer;
