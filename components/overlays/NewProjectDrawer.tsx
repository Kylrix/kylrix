'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/openbricks/primitives';
import {
  X as CloseIcon,
  FolderKanban as ProjectIcon,
  Lock,
  Globe,
  Check,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { FormsService } from '@/lib/services/forms';
import { useWorkspace } from '@/context/WorkspaceContext';
import { listNotesByUser } from '@/lib/appwrite/note';
import { tasks } from '@/lib/kylrixflow';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { buildSubProjectCreatePayload } from '@/lib/projects/sub-projects';

const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const BORDER_HAIRLINE = 'rgba(255, 255, 255, 0.08)';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_HOVER = '#5254E8';

export function NewProjectDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const isOpen = activeContent === 'new-project';
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const { refreshWorkspaces } = useWorkspace();

  const template = drawerData?.template;
  const onSuccess = drawerData?.onCreated as ((project: any) => void) | undefined;
  const isSubProject = Boolean(drawerData?.isSubProject);
  const parentWorkspaceId = String(drawerData?.parentWorkspaceId || '').trim();
  const pendingAttachment = drawerData?.pendingAttachment as
    | { entityKind: string; entityId: string }
    | undefined;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Resources for picking
  const [resources, setResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('public');
  const [isGuest, setIsGuest] = useState(true);

  const fetchResources = useCallback(async () => {
    if (!user?.$id) return;
    setLoadingResources(true);
    try {
      if (
        template?.id === 'form-to-project' ||
        template?.id === 'service-desk' ||
        template?.id === 'event-command-center'
      ) {
        const res = await FormsService.listUserForms(user.$id);
        setResources(res?.rows || []);
      } else if (
        template?.id === 'idea-to-execution' ||
        template?.id === 'wiki-knowledge-hub' ||
        template?.id === 'product-roadmap'
      ) {
        const res = await listNotesByUser(user.$id);
        setResources(res?.rows || []);
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
      setVisibility('public');
      setIsGuest(true);

      const preSelectedId = drawerData?.selectedResourceId || drawerData?.formId || '';
      setSelectedResourceId(preSelectedId);

      const needsPicker = [
        'form-to-project',
        'idea-to-execution',
        'service-desk',
        'wiki-knowledge-hub',
        'event-command-center',
        'product-roadmap',
      ].includes(template?.id);

      if (needsPicker && !preSelectedId && !isSubProject) {
        setStep(1);
        void fetchResources();
      } else {
        setStep(2);
        if (preSelectedId) {
          if (drawerData?.formTitle) {
            setTitle(drawerData.formTitle);
            setSummary(drawerData.formDescription || '');
          }
          void fetchResources();
        }
      }
    }
  }, [isOpen, template, fetchResources, drawerData, isSubProject]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !user?.$id) return;

    setLoading(true);
    try {
      const metadata: any = {
        templateId: template?.id,
        createdAt: new Date().toISOString(),
      };

      if (template?.id === 'academic-research') {
        metadata.proFeatures = true;
        metadata.maxCharacterLimit = 6000000;
        metadata.milestones = [
          'Proposal',
          'Literature Review',
          'Data Collection',
          'Analysis',
          'Final Draft',
        ];
      }

      if (template?.id === 'idea-to-execution') {
        metadata.meetings = [{ title: 'Weekly Sync', frequency: 'weekly', day: 'Monday' }];
        metadata.vaultEnabled = true;
      }

      const project = await ProjectsService.createProject({
        title: title.trim(),
        summary: summary.trim(),
        visibility,
        isPublic: visibility === 'public',
        isGuest: visibility === 'public' ? isGuest : false,
        status: 'active',
        ...(isSubProject && parentWorkspaceId
          ? buildSubProjectCreatePayload(parentWorkspaceId)
          : { kind: 'workspace' as const, parentProjectId: null }),
        metadata: JSON.stringify(metadata),
      } as any);

      if (pendingAttachment?.entityId) {
        await attachObjectToProject({
          projectId: project.$id,
          entityKind: pendingAttachment.entityKind,
          entityId: pendingAttachment.entityId,
        });
      }

      if (selectedResourceId) {
        const resourceKind =
          template?.id === 'form-to-project' ||
          template?.id === 'service-desk' ||
          template?.id === 'event-command-center'
            ? 'form'
            : 'note';

        await attachObjectToProject({
          projectId: project.$id,
          entityKind: resourceKind,
          entityId: selectedResourceId,
        });

        if (template?.id === 'form-to-project' || template?.id === 'service-desk') {
          await tasks.create({
            title: `Process: ${title}`,
            description: `Reviewing submissions from linked form and generating roadmap for ${title}.`,
            status: 'todo',
            priority: 'high',
            userId: user.$id,
            metadata: JSON.stringify({
              origin: 'template_automation',
              sourceId: selectedResourceId,
            }),
          } as any);
        }
      }

      showSuccess(isSubProject ? 'Project created' : 'Workspace created');
      void refreshWorkspaces();
      if (onSuccess) onSuccess(project);
      close();
    } catch (err: any) {
      showError('Setup failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fontDisplay = 'var(--font-clash)';

  if (!isOpen) return null;

  const mainFormContent = (
    <Box
      sx={{
        px: { xs: 2.25, sm: 3 },
        pb: 'max(20px, env(safe-area-inset-bottom))',
        pt: isDesktop ? 2.5 : 1,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: SURFACE_ASH,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2.5,
          pb: 1.5,
          borderBottom: `1px solid ${BORDER_HAIRLINE}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: SYSTEM_PRIMARY,
              flexShrink: 0,
            }}
          >
            {template?.icon ? (
              <template.icon size={18} color={template.color || SYSTEM_PRIMARY} strokeWidth={2.2} />
            ) : (
              <ProjectIcon size={18} strokeWidth={2.2} />
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              component="span"
              sx={{
                color: '#fff',
                fontWeight: 900,
                fontSize: '1.05rem',
                fontFamily: fontDisplay,
                lineHeight: 1.2,
                display: 'block',
              }}
              noWrap
            >
              {isSubProject ? 'New Project' : template?.title || 'New Workspace'}
            </Typography>
            <Typography
              component="span"
              sx={{
                color: TEXT_MUTED,
                fontSize: '0.74rem',
                display: 'block',
                mt: 0.2,
              }}
              noWrap
            >
              {step === 1 ? 'Select resource to link' : isSubProject ? 'Set up project details' : 'Set up workspace details'}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={close}
          aria-label="Close"
          size="small"
          sx={{
            width: 32,
            height: 32,
            borderRadius: '999px',
            color: 'rgba(255, 255, 255, 0.6)',
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${BORDER_HAIRLINE}`,
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#fff' },
            flexShrink: 0,
          }}
        >
          <CloseIcon size={16} />
        </IconButton>
      </Box>

      {/* Body / Form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography
              component="span"
              sx={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Link existing {template?.id?.includes('form') ? 'Form' : 'Note'} (Optional)
            </Typography>

            {loadingResources ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={22} sx={{ color: SYSTEM_PRIMARY }} />
              </Box>
            ) : resources.length === 0 ? (
              <Box
                sx={{
                  p: 2.25,
                  borderRadius: '18px',
                  bgcolor: VOID,
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  textAlign: 'center',
                }}
              >
                <Typography component="span" sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                  No items found. You can proceed directly.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {resources.map((item) => {
                  const isSelected = selectedResourceId === item.$id;
                  return (
                    <Box
                      key={item.$id}
                      component="button"
                      type="button"
                      onClick={() => setSelectedResourceId(isSelected ? '' : item.$id)}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        borderRadius: '16px',
                        bgcolor: isSelected ? 'rgba(99, 102, 241, 0.12)' : VOID,
                        border: '1px solid',
                        borderColor: isSelected ? SYSTEM_PRIMARY : BORDER_HAIRLINE,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: isSelected
                            ? 'rgba(99, 102, 241, 0.18)'
                            : 'rgba(255,255,255,0.03)',
                        },
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          color: isSelected ? '#fff' : 'rgba(255,255,255,0.85)',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                        }}
                        noWrap
                      >
                        {item.title || item.name || 'Untitled'}
                      </Typography>
                      {isSelected && (
                        <Check size={16} color={SYSTEM_PRIMARY} style={{ flexShrink: 0 }} />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Name Input */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {isSubProject ? 'Project Name' : 'Workspace Name'}
              </Typography>
              <Box
                component="input"
                type="text"
                value={title}
                onChange={(e: any) => setTitle(e.target.value)}
                placeholder={isSubProject ? 'e.g. Marketing, Q3 Launch' : 'e.g. Q3 Roadmap, Design Studio'}
                autoFocus
                sx={{
                  width: '100%',
                  px: 2,
                  py: 1.5,
                  borderRadius: '16px',
                  bgcolor: VOID,
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  '&:focus': { borderColor: SYSTEM_PRIMARY },
                  '&::placeholder': { color: 'rgba(255,255,255,0.25)' },
                }}
              />
            </Box>

            {/* Description / Summary Input */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Description (Optional)
              </Typography>
              <Box
                component="textarea"
                rows={2}
                value={summary}
                onChange={(e: any) => setSummary(e.target.value)}
                placeholder={isSubProject ? 'What is this project about?' : 'What is this workspace about?'}
                sx={{
                  width: '100%',
                  px: 2,
                  py: 1.25,
                  borderRadius: '16px',
                  bgcolor: VOID,
                  border: `1px solid ${BORDER_HAIRLINE}`,
                  color: '#fff',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                  '&:focus': { borderColor: SYSTEM_PRIMARY },
                  '&::placeholder': { color: 'rgba(255,255,255,0.25)' },
                }}
              />
            </Box>

            {/* Tactile Visibility Segmented Control */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Access
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  p: 0.75,
                  borderRadius: '18px',
                  bgcolor: VOID,
                  border: `1px solid ${BORDER_HAIRLINE}`,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => setVisibility('public')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 1.2,
                    px: 1.5,
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    bgcolor: visibility === 'public' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    color: visibility === 'public' ? '#818CF8' : 'rgba(255, 255, 255, 0.5)',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    transition: 'all 0.2s',
                    '&:hover': { color: '#fff' },
                  }}
                >
                  <Globe size={15} />
                  <span>Public</span>
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setVisibility('private')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 1.2,
                    px: 1.5,
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    bgcolor:
                      visibility === 'private' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: visibility === 'private' ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    transition: 'all 0.2s',
                    '&:hover': { color: '#fff' },
                  }}
                >
                  <Lock size={15} />
                  <span>Private</span>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* CTA Buttons */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          {step === 1 ? (
            <Button
              fullWidth
              onClick={() => setStep(2)}
              sx={{
                bgcolor: SYSTEM_PRIMARY,
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.9rem',
                py: 1.4,
                borderRadius: '16px',
                textTransform: 'none',
                '&:hover': { bgcolor: SYSTEM_HOVER },
              }}
            >
              Continue
            </Button>
          ) : (
            <Stack direction="row" spacing={1.25}>
              {['form-to-project', 'idea-to-execution'].includes(template?.id) && (
                <Button
                  onClick={() => setStep(1)}
                  sx={{
                    px: 2.25,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    border: `1px solid ${BORDER_HAIRLINE}`,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    borderRadius: '16px',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || !title.trim()}
                sx={{
                  flex: 1,
                  bgcolor: SYSTEM_PRIMARY,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  py: 1.4,
                  borderRadius: '16px',
                  textTransform: 'none',
                  '&:hover': { bgcolor: SYSTEM_HOVER },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(99, 102, 241, 0.3)',
                    color: 'rgba(255,255,255,0.3)',
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={18} sx={{ color: '#fff' }} />
                ) : (
                  isSubProject ? 'Create Project' : 'Create Workspace'
                )}
              </Button>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );

  if (isDesktop) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: SURFACE_ASH,
        }}
      >
        {mainFormContent}
      </Box>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={close}
      keepMounted={false}
      disablePortal={true}
      sx={{
        '& .ob-drawer-panel': {
          maxHeight: '85dvh',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          border: `1px solid ${BORDER_HAIRLINE}`,
          borderBottom: 0,
          bgcolor: SURFACE_ASH,
          boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          pt: 1.5,
          pb: 0.5,
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)' }} />
      </Box>
      {mainFormContent}
    </Drawer>
  );
}
