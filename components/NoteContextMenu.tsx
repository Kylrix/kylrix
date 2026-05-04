'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Stack,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  InputAdornment,
  Typography,
  IconButton,
  Drawer,
  Fade,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon, DragHandle as DragHandleIcon, Check as CheckIcon } from '@mui/icons-material';
import type { Notes } from '@/types/appwrite';
import { updateNote } from '@/lib/appwrite';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

interface PaywallDrawerProps {
  open: boolean;
  onClose: () => void;
  note: Notes;
  onUpdate?: (note: Notes) => void;
}

const PaywallDrawer: React.FC<PaywallDrawerProps> = ({
  open,
  onClose,
  note,
  onUpdate,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { setIsDrawerOpen } = useDrawerState();
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStartY = useRef(0);

  const metadata = typeof note.metadata === 'string' 
    ? JSON.parse(note.metadata || '{}') 
    : note.metadata || {};
  const currentPaywall = metadata?.paywall;

  const [hasPaywall, setHasPaywall] = useState(() => !!currentPaywall?.enabled);
  const [paywallAmount, setPaywallAmount] = useState<number | ''>(() => currentPaywall?.amount || '');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsExpanded(false);
      setIsDrawerOpen(false);
    } else {
      setHasPaywall(!!currentPaywall?.enabled);
      setPaywallAmount(currentPaywall?.amount || '');
      setIsDrawerOpen(true);
    }
  }, [open, currentPaywall, setIsDrawerOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartY.current === 0) return;
    
    const deltaY = dragStartY.current - e.clientY;
    const threshold = 100;
    
    if (deltaY > threshold && !isExpanded) {
      setIsExpanded(true);
    }
    if (deltaY < -threshold && isExpanded) {
      setIsExpanded(false);
    }
  };

  const handleMouseUp = () => {
    dragStartY.current = 0;
  };

  const drawerHeight = isMobile 
    ? (isExpanded ? '100dvh' : '60dvh')
    : '100%';

  const handleSavePaywall = async () => {
    setIsSaving(true);
    try {
      const updatedNote = await updateNote(note.$id, {
        metadata: JSON.stringify({
          ...metadata,
          paywall: hasPaywall && paywallAmount ? {
            enabled: true,
            amount: typeof paywallAmount === 'number' ? paywallAmount : parseFloat(paywallAmount),
            currency: 'USD',
          } : {
            enabled: false,
            amount: 0,
            currency: 'USD',
          },
        }),
      });
      onUpdate?.(updatedNote as Notes);
      onClose();
    } catch (error) {
      console.error('Failed to update paywall:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsDrawerOpen(false);
    onClose();
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={handleClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 720px)',
          maxWidth: isMobile ? '100%' : '720px',
          height: drawerHeight,
          maxHeight: '100dvh',
          borderTopLeftRadius: isMobile ? '24px' : 0,
          borderTopRightRadius: isMobile ? '24px' : 0,
          borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          bgcolor: '#161412',
          boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.3s ease-out',
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(10px)',
          }
        }
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 0,
            flex: 1,
            maxHeight: '100vh',
            userSelect: 'none',
          }}
          onMouseDown={isMobile ? handleMouseDown : undefined}
          onMouseMove={isMobile ? handleMouseMove : undefined}
          onMouseUp={isMobile ? handleMouseUp : undefined}
        >
          {/* Header with drag handle */}
          {isMobile && (
            <Box sx={{ 
              p: 2, 
              pt: 2.5,
              textAlign: 'center', 
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <DragHandleIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.2)' }} />
            </Box>
          )}

          {/* Desktop Close button */}
          {!isMobile && (
            <Box sx={{ 
              p: 2.5, 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.05)' 
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: 'white', 
                  fontWeight: 700,
                  fontFamily: 'var(--font-satoshi)',
                  fontSize: '1.125rem',
                  letterSpacing: '-0.01em'
                }}
              >
                {currentPaywall?.enabled ? 'Edit Paywall' : 'Add Paywall'}
              </Typography>
              <IconButton 
                onClick={handleClose} 
                sx={{ 
                  color: 'rgba(255,255,255,0.6)',
                  '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          )}

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 2.5 : 3 }}>
            {isMobile && (
              <Typography 
                variant="h6" 
                sx={{ 
                  color: 'white', 
                  fontWeight: 700,
                  fontFamily: 'var(--font-satoshi)',
                  fontSize: '1.125rem',
                  letterSpacing: '-0.01em',
                  mb: 3
                }}
              >
                {currentPaywall?.enabled ? 'Edit Paywall' : 'Add Paywall'}
              </Typography>
            )}

            <Stack spacing={3}>
              <Box sx={{
                p: 2.5,
                borderRadius: '16px',
                bgcolor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={hasPaywall} 
                        onChange={(e) => setHasPaywall(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase': {
                            color: 'rgba(255,255,255,0.4)',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#6366F1',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#6366F1',
                          },
                        }}
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
                  />
                </Box>
                <Box>
                  <Typography 
                    sx={{ 
                      color: 'white', 
                      fontWeight: 600,
                      fontFamily: 'var(--font-satoshi)',
                      fontSize: '0.95rem',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    Lock content with paywall
                  </Typography>
                  <Typography 
                    sx={{ 
                      color: 'rgba(255,255,255,0.5)', 
                      fontFamily: 'var(--font-satoshi)',
                      fontSize: '0.85rem',
                      mt: 0.5,
                      lineHeight: 1.4
                    }}
                  >
                    Readers must pay to access this note
                  </Typography>
                </Box>
              </Box>

              {hasPaywall && (
                <Box>
                  <Typography 
                    sx={{ 
                      color: 'rgba(255,255,255,0.7)', 
                      fontFamily: 'var(--font-satoshi)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      mb: 1.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Price (USD)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    inputProps={{ step: '0.01', min: '0', max: '9999.99' }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.6)' }}>$</InputAdornment>,
                      endAdornment: <InputAdornment position="end" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)' }}>USD</InputAdornment>,
                    }}
                    value={paywallAmount}
                    onChange={(e) => setPaywallAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="0.00"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px',
                        color: 'white',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        fontSize: '1rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        '& input::placeholder': {
                          color: 'rgba(255,255,255,0.3)',
                          opacity: 1,
                        }
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.08)',
                        transition: 'border-color 0.2s'
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.12)',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(99, 102, 241, 0.4)',
                      },
                    }}
                  />
                </Box>
              )}
            </Stack>
          </Box>

          {/* Footer with action buttons */}
          <Box sx={{ 
            p: isMobile ? 2.5 : 3, 
            borderTop: '1px solid rgba(255,255,255,0.05)', 
            display: 'flex', 
            gap: 2,
            bgcolor: 'rgba(0,0,0,0.1)'
          }}>
            <Button
              onClick={handleClose}
              fullWidth
              sx={{ 
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '14px',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 600,
                fontSize: '0.95rem',
                py: 1.75,
                transition: 'all 0.2s',
                '&:hover': {
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.2)',
                  bgcolor: 'rgba(255,255,255,0.04)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePaywall}
              disabled={isSaving || (hasPaywall && !paywallAmount)}
              variant="contained"
              fullWidth
              startIcon={isSaving ? undefined : <CheckIcon />}
              sx={{
                bgcolor: '#6366F1',
                color: 'white',
                borderRadius: '14px',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 700,
                fontSize: '0.95rem',
                py: 1.75,
                transition: 'all 0.2s',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
                '&:hover': {
                  bgcolor: '#4F46E5',
                  boxShadow: '0 12px 24px rgba(99, 102, 241, 0.4)',
                  transform: 'translateY(-1px)'
                },
                '&:active': {
                  transform: 'translateY(0)'
                },
                '&:disabled': {
                  bgcolor: 'rgba(99, 102, 241, 0.4)',
                  color: 'rgba(255,255,255,0.5)',
                  boxShadow: 'none',
                }
              }}
            >
              {isSaving ? 'Saving...' : 'Save Paywall'}
            </Button>
          </Box>
        </Box>
      </Fade>
    </Drawer>
  );
};

export default PaywallDrawer;
