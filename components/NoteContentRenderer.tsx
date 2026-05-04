'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import NoteContentDisplay from '@/components/NoteContentDisplay';
import { LinkComponent } from '@/components/LinkRenderer';
import { preProcessMarkdown } from '@/lib/markdown';

interface NoteContentRendererProps {
  content?: string | null;
  format?: 'text' | 'doodle' | null;
  emptyFallback?: React.ReactNode;
  preview?: boolean;
  onEditDoodle?: () => void;
}

export function NoteContentRenderer({
  content,
  format = 'text',
  emptyFallback = <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.3)' }}>This note is empty.</Typography>,
  preview = false,
  onEditDoodle,
}: NoteContentRendererProps) {
  const noteFormat = format === 'doodle' ? 'doodle' : 'text';

  if (noteFormat === 'doodle') {
    return (
      <NoteContentDisplay
        content={content || ''}
        format="doodle"
        preview={preview}
        onEditDoodle={onEditDoodle}
      />
    );
  }

  const trimmed = content?.trim();
  if (!trimmed) {
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
          letterSpacing: '-0.02em'
        },
        '& h2': { 
          fontSize: '1.875rem', 
          fontWeight: 800, 
          mb: 3, 
          mt: 4, 
          color: 'white',
          letterSpacing: '-0.01em'
        },
        '& h3': { 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          mb: 2, 
          mt: 3, 
          color: 'white' 
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
          color: 'rgba(255, 255, 255, 0.8)'
        },
        '& code': {
          bgcolor: 'rgba(255, 255, 255, 0.1)',
          px: 1,
          py: 0.5,
          borderRadius: '6px',
          fontSize: '0.9em',
          fontFamily: 'monospace',
          color: '#6366F1'
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
            color: 'inherit'
          }
        },
        '& img': {
          maxWidth: '100%',
          borderRadius: '16px',
          my: 4
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          my: 6
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: LinkComponent,
        }}
      >
        {preProcessMarkdown(trimmed)}
      </ReactMarkdown>
    </Box>
  );
}

export default NoteContentRenderer;

