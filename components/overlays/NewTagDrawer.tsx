'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Button, 
  TextField, 
  Grid, 
  CircularProgress, 
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
  Paper
} from '@/lib/mui-tailwind/material';
import { 
  X as CloseIcon,
  Plus as PlusIcon,
  Tag as TagIcon,
  ArrowUpRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Tags } from '@/types/appwrite';
import { createTag, updateTag } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { ID } from 'appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSection } from '@/context/SectionContext';

const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const LIFTED = '#1F1D1B';
const BORDER_HAIRLINE = '#34322F';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_HOVER = '#575CF0';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
const RADIUS_LARGE = '24px';
const RADIUS_MEDIUM = '16px';
const RADIUS_SMALL = '12px';

const predefinedColors = [
  '#6366F1', // Electric Teal
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export function NewTagDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { setActiveDetail } = useSection();
  const isOpen = activeContent === 'new-tag';
  const { user } = useAuth();
  
  const editingTag = drawerData?.tag as Tags | undefined;
  const onSuccess = drawerData?.onSuccess as (() => void) | undefined;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft when drawer opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || editingTag) {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:tag');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        setFormData(draft);
      } catch (e) {
        console.error('Failed to parse tag draft', e);
      }
    }
    setIsHydrated(true);
  }, [isOpen, editingTag]);

  // Save draft on changes
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !isHydrated || editingTag) return;
    if (formData.name.trim() || formData.description.trim()) {
      localStorage.setItem('kylrix:draft:tag', JSON.stringify(formData));
    } else {
      localStorage.removeItem('kylrix:draft:tag');
    }
  }, [isOpen, isHydrated, formData, editingTag]);

  useEffect(() => {
    if (isOpen) {
      if (editingTag) {
        setFormData({
          name: editingTag.name || '',
          description: editingTag.description || '',
          color: editingTag.color || '#6366F1',
        });
      } else {
        setFormData({
          name: '',
          description: '',
          color: '#6366F1',
        });
      }
      setError(null);
    }
  }, [isOpen, editingTag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.$id || !formData.name.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      if (editingTag) {
        await updateTag(editingTag.$id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        });
      } else {
        await createTag({
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        });
      }
      
      if (!editingTag && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:tag');
      }
      if (onSuccess) onSuccess();
      close();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMorphToDetail = async () => {
    if (!user?.$id || !formData.name.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      let savedTag: any;
      if (editingTag) {
        savedTag = await updateTag(editingTag.$id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        });
      } else {
        savedTag = await createTag({
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        });
      }
      
      if (!editingTag && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:tag');
      }
      if (onSuccess) onSuccess();
      if (savedTag) {
        setActiveDetail({ type: 'tag', id: savedTag.$id || savedTag.id || formData.name.trim(), data: savedTag });
      }
      close();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setIsSaving(false);
    }
  };

  const fontUi = 'var(--font-satoshi)';
  const fontDisplay = 'var(--font-clash)';

  if (!isOpen) return null;

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={isOpen}
      onClose={close}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      sx={{
        '& .MuiDrawer-paper': {
          ...(isDesktop
            ? {
                top: '88px',
                right: 0,
                height: 'calc(100vh - 88px)',
                width: 'min(460px, 94vw)',
                maxWidth: 'min(460px, 94vw)',
                borderTopLeftRadius: RADIUS_LARGE,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderLeft: BORDER,
                borderTop: BORDER,
                borderBottom: 0,
                borderRight: 0,
              }
            : {
                height: isExpanded ? '100dvh' : '60dvh',
                minHeight: '60dvh',
                maxHeight: '100dvh',
                transition: BRAND_TRANSITION,
                borderTopLeftRadius: RADIUS_LARGE,
                borderTopRightRadius: RADIUS_LARGE,
                border: BORDER,
                borderBottom: 0,
              }),
          bgcolor: SURFACE_ASH,
          boxShadow: 'none',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2.25, sm: 2.75 },
          pb: 'max(20px, env(safe-area-inset-bottom))',
          pt: 3,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: RADIUS_SMALL,
                display: 'grid',
                placeItems: 'center',
                bgcolor: VOID,
                border: BORDER,
              }}
            >
              <TagIcon size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />
            </Box>
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 900,
                fontSize: '1.25rem',
                fontFamily: fontDisplay,
                letterSpacing: '-0.02em',
              }}
            >
              {editingTag ? 'Edit Tag' : 'New Tag'}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {formData.name.trim().length > 0 && (
              <IconButton 
                onClick={handleMorphToDetail} 
                aria-label="Go Full Detail"
                title="Go Full Detail"
                sx={{
                  color: '#F59E0B',
                  bgcolor: VOID,
                  border: BORDER,
                  borderRadius: RADIUS_SMALL,
                  '&:hover': { bgcolor: HOVER }
                }}
              >
                <ArrowUpRight size={18} />
              </IconButton>
            )}
            {!isDesktop && (
              <IconButton 
                onClick={() => setIsExpanded(!isExpanded)} 
                aria-label="Toggle Fullscreen"
                sx={{
                  color: '#E8E6E3',
                  bgcolor: VOID,
                  border: BORDER,
                  borderRadius: RADIUS_SMALL,
                  '&:hover': { bgcolor: HOVER }
                }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </IconButton>
            )}
            <IconButton
              onClick={close}
              aria-label="Close"
              sx={{
                color: '#E8E6E3',
                bgcolor: VOID,
                border: BORDER,
                borderRadius: RADIUS_SMALL,
                '&:hover': { bgcolor: HOVER },
              }}
            >
              <CloseIcon size={18} />
            </IconButton>
          </Stack>
        </Stack>

        <Box 
          component="form" 
          onSubmit={handleSubmit}
          sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            overflowY: 'auto',
            pr: 0.5
          }}
        >
          {error && (
            <Paper sx={{ p: 1.5, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
              <Typography sx={{ color: '#FCA5A5', fontSize: '0.8rem', fontWeight: 600 }}>{error}</Typography>
            </Paper>
          )}

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Tag Name
            </Typography>
            <TextField
              fullWidth
              required
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Research"
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: VOID,
                  borderRadius: '16px',
                  color: 'white',
                  px: 2,
                  py: 1.5,
                  fontFamily: fontUi,
                  fontWeight: 600,
                  border: BORDER,
                  '&:hover': { borderColor: '#4F4C49' },
                  '&.Mui-focused': { borderColor: SYSTEM_PRIMARY }
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Description
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes about this tag..."
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  bgcolor: VOID,
                  borderRadius: '16px',
                  color: 'white',
                  px: 2,
                  py: 1.5,
                  fontFamily: fontUi,
                  fontWeight: 500,
                  border: BORDER,
                  '&:hover': { borderColor: '#4F4C49' },
                  '&.Mui-focused': { borderColor: SYSTEM_PRIMARY }
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Theme Color
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 1 }}>
              {predefinedColors.map((color) => (
                <Grid size="auto" key={color}>
                  <Tooltip title={color} arrow>
                    <Box
                      onClick={() => setFormData({ ...formData, color })}
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        bgcolor: color,
                        cursor: 'pointer',
                        border: '3px solid',
                        borderColor: formData.color === color ? 'white' : 'transparent',
                        transition: BRAND_TRANSITION,
                        '&:hover': { transform: 'scale(1.1)' }
                      }}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
            
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2, p: 1.5, bgcolor: VOID, borderRadius: RADIUS_SMALL, border: BORDER }}>
               <Box sx={{ position: 'relative', width: 32, height: 32, borderRadius: '6px', overflow: 'hidden', border: BORDER }}>
                 <input 
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{ 
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    background: 'none'
                  }}
                 />
               </Box>
               <Typography variant="caption" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                 {formData.color.toUpperCase()}
               </Typography>
            </Stack>
          </Box>

          <Box sx={{ mt: 'auto', pt: 4 }}>
            <Button 
              fullWidth
              type="submit"
              variant="contained"
              disabled={isSaving || !formData.name.trim()}
              sx={{
                bgcolor: SYSTEM_PRIMARY,
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.9rem',
                py: 1.75,
                borderRadius: RADIUS_SMALL,
                textTransform: 'none',
                boxShadow: 'none',
                transition: BRAND_TRANSITION,
                '&:hover': { bgcolor: SYSTEM_HOVER },
                '&.Mui-disabled': { bgcolor: HOVER, color: TEXT_MUTED }
              }}
            >
              {isSaving ? <CircularProgress size={20} color="inherit" /> : (editingTag ? 'Update Tag' : 'Create Tag')}
            </Button>
            
            <Button 
              fullWidth
              onClick={close}
              sx={{ 
                mt: 1.5,
                color: TEXT_MUTED, 
                fontWeight: 700, 
                fontSize: '0.85rem',
                textTransform: 'none',
                '&:hover': { color: '#fff', bgcolor: 'transparent' }
              }}
            >
              Dismiss
            </Button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
