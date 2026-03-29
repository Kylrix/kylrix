import { Box, Container, Typography } from '@mui/material';

export const dynamic = 'force-dynamic';

export default function ShortLinkPlaceholderPage({
  params,
}: {
  params: { slug?: string[] };
}) {
  const token = params.slug?.join('/') || '';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: '#000', color: 'white' }}>
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.03em' }}>
          Short Link Resolver
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Reserved dynamic route for future ecosystem and external URI resolution.
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
          /i/{token || '...'}
        </Typography>
      </Container>
    </Box>
  );
}
