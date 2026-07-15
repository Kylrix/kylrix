import { Box, Button, Paper, Stack, Typography } from '@/lib/openbricks/primitives';
export function RouteErrorBoundary({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const handleRetry = () => {
    try {
      localStorage.removeItem('kylrix:draft:note');
    } catch {}
    reset();
  };

  const handleReload = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
    } catch {}
    window.location.reload();
  };

  // Auto-recovery for chunk mismatch errors
  const isChunkError = /loading.*chunk|failed to fetch.*dynamically|import.*failed/i.test(error?.message || '');
  if (isChunkError && typeof window !== 'undefined') {
    setTimeout(handleReload, 800);
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Paper sx={{ p: 3, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.08)', maxWidth: 520, width: '100%' }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
            Route error
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            {error.message}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleRetry}>
              Retry
            </Button>
            <Button variant="outlined" onClick={handleReload}>
              Reload
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
