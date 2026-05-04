import { ReactNode } from "react";
import { Drawer as MuiDrawer, IconButton, useTheme, useMediaQuery, Box } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

export function Drawer({
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
    <MuiDrawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 600px)',
          maxWidth: '100%',
          height: isMobile ? '92dvh' : '100%',
          maxHeight: '100dvh',
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          backgroundImage: 'none',
          color: 'white',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
      sx={{
        '& .MuiBackdrop-root': {
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)'
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
      <Box sx={{ 
        p: 3, 
        pt: 5,
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': {
          width: '6px'
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '3px',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.2)'
          }
        }
      }}>
        {children}
      </Box>
    </MuiDrawer>
  );
}
