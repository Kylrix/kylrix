'use client';
import { useColors } from '@/lib/theme-context';
import {
  Drawer,
  Button,
  Typography,
  CircularProgress,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  const dynamicColors = useColors();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Drawer 
      anchor={isMobile ? 'bottom' : 'right'}
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          backgroundColor: dynamicColors.secondary,
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ 
        color: 'white', 
        pb: 1, 
        pt: 3, 
        px: 3, 
        fontWeight: 800, 
        fontSize: '1.25rem',
        fontFamily: '"Space Grotesk", sans-serif',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        flexShrink: 0,
      }}>
        {title}
      </Box>
      <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
        <Typography sx={{ 
          fontSize: '0.95rem', 
          color: dynamicColors.foreground,
          lineHeight: 1.6,
          fontWeight: 500
        }}>
          {message}
        </Typography>
      </Box>
      <Box sx={{ p: 3, pt: 1, gap: 1.5, display: 'flex', borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Button 
          onClick={onClose} 
          disabled={isLoading} 
          sx={{ 
            color: dynamicColors.foreground,
            borderRadius: '0.75rem',
            textTransform: 'none',
            fontWeight: 700,
            px: 3,
            py: 1,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          variant="contained"
          sx={{
            backgroundColor: isDestructive ? '#ef4444' : dynamicColors.primary,
            color: isDestructive ? 'white' : 'black',
            borderRadius: '0.75rem',
            textTransform: 'none',
            fontWeight: 800,
            px: 4,
            py: 1,
            boxShadow: isDestructive 
              ? '0 10px 15px -3px rgba(239, 68, 68, 0.3)' 
              : '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
            '&:hover:not(:disabled)': { 
              backgroundColor: isDestructive ? '#dc2626' : '#00D1DA',
              transform: 'translateY(-1px)',
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : confirmLabel}
        </Button>
      </Box>
    </Drawer>
  );
}
