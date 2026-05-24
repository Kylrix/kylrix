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
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { FormsService } from '@/lib/services/forms';
import { listNotesByUser } from '@/lib/appwrite/note';
import { tasks } from '@/lib/kylrixflow';
import { ID } from 'appwrite';

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

export function NewProjectDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const isOpen = activeContent === 'new-project';
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();

  const template = drawerData?.template;
  const onSuccess = drawerData?.onCreated as ((project: any) => void) | undefined;

  const [step, setStep] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Resources for picking
  const [resources, setResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'public'>('private');

  const fetchResources = useCallback(async () => {
    if (!user?.$id) return;
    setLoadingResources(true);
    try {
        if (template?.id === 'form-to-project' || template?.id === 'service-desk' || template?.id === 'event-command-center') {
            const res = await FormsService.listUserForms(user.$id);
            setResources(res?.rows || []);
        } else if (template?.id === 'idea-to-execution' || template?.id === 'wiki-knowledge-hub' || template?.id === 'product-roadmap') {
            const res = await listNotesByUser(user.$id);
            setResources(res?.documents || []);
        }
    } catch (e) {
        console.error('Failed to fetch resources', e);
    } finally {
        setLoadingResources(false);
    }
  }, [user?.$id, template?.id]);

  useEffect(() => {
    if (isOpen) {
      setTitle(template?.title || '');
      setSummary(template?.summary || '');
      setVisibility('private');
      setIsExpanded(false);

      const preSelectedId = drawerData?.selectedResourceId || drawerData?.formId || '';
      setSelectedResourceId(preSelectedId);
      
      // Determine if we need a picker step
      const needsPicker = ['form-to-project', 'idea-to-execution', 'service-desk', 'wiki-knowledge-hub', 'event-command-center', 'product-roadmap'].includes(template?.id);
      if (needsPicker && !preSelectedId) {
          setStep(1);
          fetchResources();
      } else {
          setStep(2);
          if (preSelectedId) {
              if (drawerData?.formTitle) {
                  setTitle(drawerData.formTitle);
                  setSummary(drawerData.formDescription || '');
              }
              fetchResources();
          }
      }
    }
  }, [isOpen, template, fetchResources, drawerData]);

  const handleResourceSelect = (id: string) => {
    setSelectedResourceId(id);
    const selected = resources.find(r => r.$id === id);
    if (selected) {
        setTitle(selected.title || selected.name || template?.title);
        setSummary(selected.description || selected.summary || template?.summary);
    }
    setStep(2);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !user?.$id) return;

    setLoading(true);
    try {
      // 1. Prepare Metadata based on template
      const metadata: any = {
        templateId: template?.id,
        createdAt: new Date().toISOString(),
      };

      if (template?.id === 'academic-research') {
          metadata.proFeatures = true;
          metadata.maxCharacterLimit = 6000000;
          metadata.milestones = ['Proposal', 'Literature Review', 'Data Collection', 'Analysis', 'Final Draft'];
      }

      if (template?.id === 'idea-to-execution') {
          metadata.meetings = [{ title: 'Weekly Sync', frequency: 'weekly', day: 'Monday' }];
          metadata.vaultEnabled = true;
      }

      // 2. Create Project
      const project = await ProjectsService.createProject({
        title: title.trim(),
        summary: summary.trim(),
        visibility,
        isPublic: visibility === 'public',
        status: 'active',
        metadata: JSON.stringify(metadata)
      } as any);

      // 3. Post-Creation Magic (Under the hood)
      if (selectedResourceId) {
          const resourceKind = (template?.id === 'form-to-project' || template?.id === 'service-desk' || template?.id === 'event-command-center') ? 'form' : 'note';
          
          // Link Resource
          await ProjectsService.addObjectToProject(project.$id, resourceKind, selectedResourceId);
          
          // Auto-spin up Task if it's the Form-to-Project flow
          if (template?.id === 'form-to-project' || template?.id === 'service-desk') {
              await tasks.create({
                  title: `Process: ${title}`,
                  description: `Reviewing submissions from linked form and generating roadmap for ${title}.`,
                  status: 'todo',
                  priority: 'high',
                  userId: user.$id,
                  metadata: JSON.stringify({ origin: 'template_automation', sourceId: selectedResourceId })
              } as any);
          }
      }

      showSuccess('Project activated');
      if (onSuccess) onSuccess(project);
      close();
    } catch (err: any) {
      showError('Setup failed', err.message);
    } finally {
      setLoading(false);
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
              {template?.icon ? <template.icon size={20} color={template.color} strokeWidth={2.5} /> : <ProjectIcon size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />}
            </Box>
            <Box>
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
                    {template?.title || 'New Project'}
                </Typography>
                <Typography variant="caption" sx={{ color: TEXT_MUTED, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    {step === 1 ? 'Step 1: Link Context' : 'Step 2: Finalize'}
                </Typography>
            </Box>
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
          {step === 1 && (
              <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                      Select existing {template?.id?.includes('form') ? 'Form' : 'Note'} to link
                  </Typography>
                  
                  {loadingResources ? (
                      <Stack direction="row" justifyContent="center" py={4}>
                          <CircularProgress size={24} sx={{ color: template?.color || SYSTEM_PRIMARY }} />
                      </Stack>
                  ) : resources.length === 0 ? (
                      <Box sx={{ p: 3, bgcolor: VOID, borderRadius: '16px', border: BORDER, textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ color: TEXT_MUTED, mb: 2 }}>You don&apos;t have any {template?.id?.includes('form') ? 'forms' : 'notes'} to link yet.</Typography>
                          <Button variant="outlined" size="small" onClick={() => setStep(2)} sx={{ color: '#fff', borderColor: BORDER_HAIRLINE }}>Skip & Create Manual</Button>
                      </Box>
                  ) : (
                      <Stack spacing={1}>
                          {resources.map((res) => (
                              <Box
                                  key={res.$id}
                                  onClick={() => handleResourceSelect(res.$id)}
                                  sx={{
                                      p: 2,
                                      borderRadius: '16px',
                                      bgcolor: VOID,
                                      border: '1px solid',
                                      borderColor: BORDER_HAIRLINE,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      '&:hover': { borderColor: template?.color || SYSTEM_PRIMARY, bgcolor: HOVER }
                                  }}
                              >
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>{res.title || res.name}</Typography>
                                  <Typography variant="caption" sx={{ color: TEXT_MUTED, display: 'block', mt: 0.5 }}>{new Date(res.$createdAt).toLocaleDateString()}</Typography>
                              </Box>
                          ))}
                          <Button variant="text" size="small" onClick={() => setStep(2)} sx={{ color: TEXT_MUTED, mt: 1 }}>Skip to manual setup</Button>
                      </Stack>
                  )}
              </Box>
          )}

          {step === 2 && (
              <>
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
                            bgcolor: template?.color || SYSTEM_PRIMARY,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            py: 1.75,
                            borderRadius: RADIUS_SMALL,
                            textTransform: 'none',
                            boxShadow: 'none',
                            transition: BRAND_TRANSITION,
                            '&:hover': { bgcolor: template?.color || SYSTEM_HOVER, filter: 'brightness(0.9)' },
                            '&.Mui-disabled': { bgcolor: HOVER, color: TEXT_MUTED }
                        }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : `Activate ${template?.title || 'Project'}`}
                    </Button>
                    
                    <Button 
                        fullWidth
                        onClick={() => ['form-to-project', 'idea-to-execution'].includes(template?.id) ? setStep(1) : close()}
                        sx={{ 
                            mt: 1.5,
                            color: TEXT_MUTED, 
                            fontWeight: 700, 
                            fontSize: '0.85rem',
                            textTransform: 'none',
                            '&:hover': { color: '#fff', bgcolor: 'transparent' }
                        }}
                    >
                        {['form-to-project', 'idea-to-execution'].includes(template?.id) ? 'Back' : 'Dismiss'}
                    </Button>
                </Box>
              </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
