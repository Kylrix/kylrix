'use client';
import { Box, Grid, Paper, Stack, Typography, alpha } from '@mui/material';
import DocsShell from '@/components/docs/DocsShell';
import {
  DOCS_ARTICLES,
  DOCS_CATEGORIES,
  DOCS_FEATURED,
  DocsCard,
  DocsLandingAction,
  DocsLandingHero,
  DocsLandingSearchTip,
} from '@/components/docs/catalog';

export default function DocsPage() {
  return (
    <DocsShell>
      <Stack spacing={6}>
        <DocsLandingHero />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <DocsLandingAction />
          <DocsLandingSearchTip />
        </Stack>

        <Grid container spacing={2.5}>
          {DOCS_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = DOCS_ARTICLES.filter((article) => article.category === category.id).length;
            return (
              <Grid key={category.id} size={{ xs: 12, md: 6 }}>
                <Paper
                  sx={{
                    p: 3,
                    height: '100%',
                    bgcolor: alpha('#fff', 0.03),
                    border: `1px solid ${alpha(category.accent, 0.12)}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                    <Box sx={{ color: category.accent }}>
                      <Icon size={18} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ color: category.accent, fontWeight: 900, letterSpacing: '0.16em' }}>
                      {category.title}
                    </Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
                    {count} article{count === 1 ? '' : 's'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    {category.summary}
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
            Featured docs
          </Typography>
          <Grid container spacing={2.5}>
            {DOCS_FEATURED.map((article) => (
              <Grid key={article.slug} size={{ xs: 12, md: 6 }}>
                <DocsCard article={article} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Stack>
    </DocsShell>
  );
}
