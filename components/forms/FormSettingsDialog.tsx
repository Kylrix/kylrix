'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Button,
  Box,
  Typography,
  IconButton,
  Stack,
  FormControlLabel,
  Switch,
  TextField,
  Divider,
  alpha,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  EventBusy as ExpiryIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { Forms, FormsStatus } from '@/generated/appwrite/types';

interface FormSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  form: Forms | null;
  onSaved: () => void;
}

export default function FormSettingsDialog({ open, onClose, form, onSaved }: FormSettingsDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [allowAnonymousView, setAllowAnonymousView] = useState(false);
  const [allowAnonymousFill, setAllowAnonymousFill] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  useEffect(() => {
    if (form && open) {
      setStatus(form.status as any);
      let settings: any = {};
      try {
        settings = JSON.parse(form.settings || '{}');
      } catch (_e) {}
      
      setAllowAnonymousView(settings.allowAnonymousView ?? (form.status === 'published'));
      setAllowAnonymousFill(settings.allowAnonymousFill ?? false);
      setExpiresAt(settings.expiresAt ? settings.expiresAt.slice(0, 16) : '');
    }
  }, [form, open]);

  const handleSave = async () => {
    if (!form) return;
    setLoading(true);
    try {
      const settings = {
        allowAnonymousView,
        allowAnonymousFill,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      await FormsService.updateForm(form.$id, {
        status: status as FormsStatus,
        settings: JSON.stringify(settings),
      });
      
      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to update form settings', error);
    } finally {
      setLoading(false);
    }
  };

  const copyPublicLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/form/${form.$id}`;
    navigator.clipboard.writeText(url);
    setShowCopySuccess(true);
  };

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <>
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
            bgcolor: 'rgba(10, 10, 10, 0.95)', 
            backdropFilter: 'blur(40px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: isMobile ? '24px 24px 0 0' : '0',
            backgroundImage: 'none',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <Box sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              Portal Configuration
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {form?.title.toUpperCase()}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, pt: 2, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={3.5}>
            {/* PUBLISH STATE */}
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, letterSpacing: '0.1em', mb: 2, display: 'block' }}>
                DEPLOYMENT
              </Typography>
              <Stack spacing={2}>
                <Box 
                  sx={{ 
                    p: 2, 
                    borderRadius: 3, 
                    bgcolor: status === 'published' ? alpha('#10B981', 0.05) : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: status === 'published' ? alpha('#10B981', 0.2) : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PublicIcon sx={{ color: status === 'published' ? '#10B981' : 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>Public Visibility</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        {status === 'published' ? 'Accessible via unique URL' : 'Internal access only'}
                      </Typography>
                    </Box>
                  </Box>
                  <Switch 
                    checked={status === 'published'} 
                    onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10B981' } }}
                  />
                </Box>

                {status === 'published' && (
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    startIcon={<CopyIcon />}
                    onClick={copyPublicLink}
                    sx={{ borderRadius: 2, borderStyle: 'dashed', fontWeight: 800, py: 1 }}
                  >
                    Copy Portal Link
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider sx={{ opacity: 0.05 }} />

            {/* PERMISSIONS */}
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, letterSpacing: '0.1em', mb: 2, display: 'block' }}>
                ACCESS CONTROL
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={<Switch size="small" checked={allowAnonymousFill} onChange={(e) => setAllowAnonymousFill(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>Allow guest submissions</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>If off, only signed-in users can respond</Typography>
                    </Box>
                  }
                  sx={{ mb: 1 }}
                />
              </Stack>
            </Box>

            <Divider sx={{ opacity: 0.05 }} />

            {/* EXPIRY */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ExpiryIcon sx={{ fontSize: 18, color: isExpired ? '#D14343' : 'text.secondary' }} />
                <Typography variant="overline" sx={{ color: isExpired ? '#D14343' : 'text.secondary', fontWeight: 900, letterSpacing: '0.1em' }}>
                  AUTO-CLOSURE
                </Typography>
              </Box>
              
              <TextField
                fullWidth
                type="datetime-local"
                label="Closure Timestamp"
                variant="filled"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{ disableUnderline: true, sx: { borderRadius: 3, fontWeight: 700 } }}
                helperText="Responses will be rejected after this time."
              />

              {isExpired && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2, bgcolor: alpha('#D14343', 0.1), color: '#D14343', '& .MuiAlert-icon': { color: '#D14343' } }}>
                  Form is currently closed.
                </Alert>
              )}
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 3, pt: 0, display: 'flex', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
          <Button onClick={onClose} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            variant="contained" 
            disabled={loading}
            onClick={handleSave}
            sx={{ 
              borderRadius: '12px', 
              px: 4, 
              fontWeight: 900,
              bgcolor: 'var(--color-primary)',
              color: 'black',
              '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
            }}
          >
            Update Configuration
          </Button>
        </Box>
      </Drawer>

      <Snackbar
        open={showCopySuccess}
        autoHideDuration={2000}
        onClose={() => setShowCopySuccess(false)}
        message="Portal Link Copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        ContentProps={{
          sx: { 
            bgcolor: 'var(--color-primary)', 
            color: 'black', 
            fontWeight: 800,
            borderRadius: 2,
            minWidth: 'auto'
          }
        }}
      />
    </>
  );
}
