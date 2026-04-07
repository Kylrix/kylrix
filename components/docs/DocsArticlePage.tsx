'use client';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import NextLink from 'next/link';
import DocsShell from '@/components/docs/DocsShell';
import { DocsCard, DocsLandingAction, getDocsArticleBySlug } from '@/components/docs/catalog';

export default function DocsArticlePage({ slug }: { slug: string[] }) {
  const normalizedSlug = slug.join('/');
  const article = getDocsArticleBySlug(normalizedSlug);

  return (
    <DocsShell>
      {article ? (
        article.render()
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.24em' }}>
              DOCUMENTATION
            </Typography>
            <Typography variant="h2" sx={{ mt: 1.5, fontWeight: 900, letterSpacing: '-0.06em' }}>
              Page not found
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, maxWidth: 780, color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
              That topic does not exist yet. Use the sidebar search or jump back to the docs landing page.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button component={NextLink} href="/docs" variant="contained" sx={{ borderRadius: 2.5, px: 3, py: 1.4, fontWeight: 800 }}>
              Back to Docs
            </Button>
            <DocsLandingAction />
          </Stack>
          <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Suggested topic
            </Typography>
            <DocsCard article={getDocsArticleBySlug('overview')!} />
          </Paper>
        </Stack>
      )}
    </DocsShell>
  );
}
