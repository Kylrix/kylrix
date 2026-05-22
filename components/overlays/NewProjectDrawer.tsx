'use client';

import React, { useState, useEffect } from 'react';
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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { 
  X as CloseIcon,
  Plus as PlusIcon,
  FolderKanban as ProjectIcon,
  Rocket, 
  ShieldAlert, 
  Briefcase, 
  Zap,
  ChevronRight,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const BORDER_HAIRLINE = '#34322F';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_HOVER = '#575CF0';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
const RADIUS_LARGE = '24px';
const RADIUS_MEDIUM = '16px';
const RADIUS_SMALL = '12px';

const suggestions = [
  { 
    title: 'Product Launch', 
    summary: 'Coordinate specs, goals, and announcements.',
    icon: Rocket,
    color: '#EC4899',
  },
  { 
    title: 'Security Audit', 
    summary: 'Secure credentials and hardening checklists.',
    icon: ShieldAlert,
    color: '#10B981',
  },
  { 
    title: 'Client Handover', 
    summary: 'Package documents and access keys.',
    icon: Briefcase,
    color: '#F59E0B',
  },
  { 
    title: 'Team Sprint', 
    summary: 'A project for active tasks and shared notes.',
    icon: Zap,
    color: '#A855F7',
  }
];

export function NewProjectDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const isOpen = activeContent === 'new-project';
  const { showSuccess, showError } = useToast();

  const onSuccess = drawerData?.onCreated as ((project: any) => void) | undefined;

  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSummary('');
      setVisibility('private');
      setIsExpanded(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const project = await ProjectsService.createProject({
        title: title.trim(),
        summary: summary.trim(),
        visibility,
        status: 'active',
      });
      showSuccess('Project created');
      if (onSuccess) onSuccess(project);
      close();
    } catch (err: any) {
      showError('Failed to create project', err.message);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (s: typeof suggestions[0]) => {
      setTitle(s.title);
      setSummary(s.summary);
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
                width: 'min(500px, 94vw)',
                maxWidth: 'min(500px, 94vw)',
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
                height: isExpanded ? '92dvh' : '60dvh',
                minHeight: '60dvh',
                maxHeight: '92dvh',
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
      {!isDesktop && (
        <Box 
            sx={{ display: 'flex', justifyContent: 'center', py: 1.5, cursor: 'pointer' }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
        </Box>
      )}

      <Box
        sx={{
          px: { xs: 2.25, sm: 2.75 },
          pb: 'max(20px, env(safe-area-inset-bottom))',
          pt: 0,
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
              <ProjectIcon size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />
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
              New Project
            </Typography>
          </Stack>
          <IconButton
            onClick={close}
            aria-label="Close"
            sx={{
              color: '#E8E6E3',
              bgcolor: VOID,
              border: BORDER,
              '&:hover': { bgcolor: HOVER },
            }}
          >
            <CloseIcon size={18} />
          </IconButton>
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
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Quick Start
            </Typography>
            <Stack spacing={1}>
                {suggestions.map((s) => (
                    <Box 
                        key={s.title}
                        onClick={() => applySuggestion(s)}
                        sx={{ 
                            p: 1.5, 
                            borderRadius: '16px', 
                            border: '1px solid',
                            bgcolor: title === s.title ? alpha(s.color, 0.08) : VOID,
                            borderColor: title === s.title ? alpha(s.color, 0.2) : BORDER_HAIRLINE,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: alpha(s.color, 0.05), borderColor: alpha(s.color, 0.1) }
                        }}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ color: s.color, display: 'grid', placeItems: 'center' }}>
                                <s.icon size={18} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>{s.title}</Typography>
                                <Typography variant="caption" sx={{ color: TEXT_MUTED, display: 'block', fontSize: '0.75rem' }}>{s.summary}</Typography>
                            </Box>
                            <ChevronRight size={14} color={TEXT_MUTED} />
                        </Stack>
                    </Box>
                ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Project Title
            </Typography>
            <TextField
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Roadmap"
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
              Summary
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Optional project overview..."
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
            <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
              Visibility
            </Typography>
            <FormControl fullWidth variant="standard">
                <Select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    disableUnderline
                    sx={{
                        color: '#fff',
                        bgcolor: VOID,
                        borderRadius: '16px',
                        fontWeight: 700,
                        px: 2,
                        py: 0.5,
                        border: BORDER,
                        fontFamily: fontUi,
                        '& .MuiSelect-select': { py: 1.5 },
                        '& .MuiSvgIcon-root': { color: TEXT_MUTED }
                    }}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                bgcolor: SURFACE_ASH,
                                border: BORDER,
                                borderRadius: '12px',
                                color: '#fff',
                                mt: 1
                            }
                        }
                    }}
                >
                    <MenuItem value="private" sx={{ fontWeight: 600 }}>Private</MenuItem>
                    <MenuItem value="shared" sx={{ fontWeight: 600 }}>Shared</MenuItem>
                    <MenuItem value="public" sx={{ fontWeight: 600 }}>Public</MenuItem>
                </Select>
            </FormControl>
          </Box>

          <Box sx={{ mt: 'auto', pt: 4 }}>
            <Button 
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading || !title.trim()}
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
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Create Project'}
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
