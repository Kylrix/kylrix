import { Box, Paper, Skeleton } from "@mui/material";

export default function CredentialSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: '20px',
        bgcolor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <Skeleton 
        variant="rounded" 
        width={48} 
        height={48} 
        sx={{ borderRadius: '14px', bgcolor: 'rgba(255, 255, 255, 0.05)' }} 
      />
      
      <Box sx={{ ml: 2.5, flexGrow: 1 }}>
        <Skeleton width="40%" height={24} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', mb: 0.5 }} />
        <Skeleton width="25%" height={16} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
        <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
      </Box>
    </Paper>
  );
}
