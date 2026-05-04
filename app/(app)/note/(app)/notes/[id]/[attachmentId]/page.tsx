"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Container, 
  Grid, 
  Paper, 
  Stack, 
  alpha,
  CircularProgress,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import { 
  ArrowBack as ArrowLeftIcon, 
  Download as ArrowDownTrayIcon,
  OpenInNew as OpenIcon,
  Description as FileIcon
} from '@mui/icons-material';
import { formatFileSize } from '@/lib/utils';

interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  createdAt: string;
}

interface AttachmentResponse {
  attachment: AttachmentMeta;
  url: string | null;
  expiresAt?: number | null;
  ttl?: number | null;
}

export default function AttachmentPage() {
  const params = useParams();
  const noteId = params?.id as string | undefined;
  const attachmentId = params?.attachmentId as string | undefined;

  const [data, setData] = useState<AttachmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId || !attachmentId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`);
        if (!res.ok) throw new Error('Failed to load attachment');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load attachment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noteId, attachmentId]);

  const meta = data?.attachment;
  const signedUrl = data?.url || null;
  const fallbackRaw = noteId && attachmentId ? `/api/notes/${noteId}/attachments/${attachmentId}?raw=1` : undefined;
  const downloadHref = signedUrl || fallbackRaw || '#';

  const isImage = meta?.mime?.startsWith('image/');
  const isText = meta?.mime?.startsWith('text/');
  const isPDF = meta?.mime === 'application/pdf';

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        bgcolor: 'rgba(15, 13, 12, 0.95)',
        color: 'white',
        p: { xs: 2, md: 4 }
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              component={Link} 
              href={`/notes/${noteId}`}
              sx={{ 
                color: 'white', 
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <ArrowLeftIcon />
            </IconButton>
            <Box>
              <Breadcrumbs sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 0.5 }}>
                <MuiLink component={Link} href="/notes" underline="hover" color="inherit">
                  Notes
                </MuiLink>
                <MuiLink component={Link} href={`/notes/${noteId}`} underline="hover" color="inherit">
                  Note
                </MuiLink>
                <Typography color="white">Attachment</Typography>
              </Breadcrumbs>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 900, 
                  fontFamily: 'var(--font-space-grotesk)',
                  background: 'linear-gradient(90deg, #fff, #6366F1)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  maxWidth: '50vw',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {meta?.name || 'Attachment'}
              </Typography>
            </Box>
          </Box>
          
          {downloadHref !== '#' && (
            <Button
              component="a"
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              download
              variant="contained"
              startIcon={<ArrowDownTrayIcon />}
              sx={{
                bgcolor: '#6366F1',
                color: '#000',
                borderRadius: '12px',
                px: 3,
                py: 1,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
              }}
            >
              Download
            </Button>
          )}
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12, gap: 2 }}>
            <CircularProgress sx={{ color: '#6366F1' }} />
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>Loading attachment...</Typography>
          </Box>
        )}

        {error && (
          <Paper sx={{ p: 3, bgcolor: alpha('#ff4d4d', 0.1), border: '1px solid rgba(255, 77, 77, 0.2)', borderRadius: '16px' }}>
            <Typography sx={{ color: '#ff4d4d' }}>{error}</Typography>
          </Paper>
        )}

        {!loading && !error && meta && (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 3 }}>
              <Paper 
                sx={{ 
                  p: 3, 
                  bgcolor: 'rgba(255, 255, 255, 0.03)', 
                  backdropFilter: 'blur(25px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '24px',
                  position: 'sticky',
                  top: 24
                }}
              >
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>
                      Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'white', wordBreak: 'break-all' }}>
                      {meta.name}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>
                        Size
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {formatFileSize(meta.size)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>
                        Type
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {meta.mime || 'unknown'}
                      </Typography>
                    </Grid>
                  </Grid>

                  {data?.expiresAt && (
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>
                        URL Expires
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {new Date(data.expiresAt).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  )}

                  <Stack spacing={1.5} sx={{ pt: 2 }}>
                    {signedUrl && (
                      <Button 
                        component="a" 
                        href={signedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        variant="outlined"
                        fullWidth
                        startIcon={<OpenIcon />}
                        sx={{ 
                          color: 'white', 
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          textTransform: 'none',
                          '&:hover': { borderColor: '#6366F1', bgcolor: 'rgba(99, 102, 241, 0.05)' }
                        }}
                      >
                        Open Signed URL
                      </Button>
                    )}
                    {fallbackRaw && (
                      <Button 
                        component="a" 
                        href={fallbackRaw} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        variant="outlined"
                        fullWidth
                        sx={{ 
                          color: 'white', 
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          textTransform: 'none',
                          '&:hover': { borderColor: '#6366F1', bgcolor: 'rgba(99, 102, 241, 0.05)' }
                        }}
                      >
                        Raw View
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 9 }}>
              <Paper 
                sx={{ 
                  minHeight: '70vh', 
                  bgcolor: 'rgba(0, 0, 0, 0.3)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {!signedUrl && !fallbackRaw && (
                  <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                    <FileIcon sx={{ fontSize: 64, mb: 2 }} />
                    <Typography>No preview available.</Typography>
                  </Box>
                )}
                {(isImage && (signedUrl || fallbackRaw)) && (
                  <Box
                    component="img"
                    src={signedUrl || fallbackRaw}
                    alt={meta.name}
                    sx={{
                      maxHeight: '80vh',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}
                  />
                )}
                {isPDF && (signedUrl || fallbackRaw) && (
                  <Box
                    component="iframe"
                    title={meta.name}
                    src={signedUrl || fallbackRaw}
                    sx={{
                      width: '100%',
                      height: '80vh',
                      border: 'none',
                      borderRadius: '12px',
                      bgcolor: 'white'
                    }}
                  />
                )}
                {isText && (signedUrl || fallbackRaw) && (
                  <Box
                    component="iframe"
                    title={meta.name}
                    src={signedUrl || fallbackRaw}
                    sx={{
                      width: '100%',
                      height: '80vh',
                      border: 'none',
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 255, 255, 0.05)'
                    }}
                  />
                )}
                {!isImage && !isText && !isPDF && (signedUrl || fallbackRaw) && (
                  <Box sx={{ textAlign: 'center', p: 4 }}>
                    <FileIcon sx={{ fontSize: 80, color: 'rgba(255, 255, 255, 0.1)', mb: 3 }} />
                    <Typography variant="h6" sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.7)' }}>
                      Preview not supported for this file type.
                    </Typography>
                    <Button
                      component="a"
                      href={downloadHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      variant="contained"
                      sx={{
                        bgcolor: '#6366F1',
                        color: '#000',
                        borderRadius: '12px',
                        px: 4,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
                      }}
                    >
                      Download File
                    </Button>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </Box>
  );
}


