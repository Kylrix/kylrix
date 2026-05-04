import { ReactNode } from "react";
import { Drawer, Box, IconButton, useTheme, useMediaQuery } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

export function Dialog({
  open,
  onClose,
  children,
  _className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  _className?: string;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 640px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
          color: 'white',
          position: 'relative',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          color: 'rgba(255, 255, 255, 0.4)',
          zIndex: 10,
          '&:hover': {
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.05)'
          }
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <Box sx={{ p: 0, flex: 1, overflowY: 'auto' }}>
        {children}
      </Box>
    </Drawer>
  );
}
