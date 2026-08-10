'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery} from '@/lib/openbricks/primitives';
import { 
  X as CloseIcon,
  FolderKanban as ProjectIcon,
  Lock,
  Globe,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { FormsService } from '@/lib/services/forms';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { listNotesByUser } from '@/lib/appwrite/note';
import { tasks } from '@/lib/kylrixflow';
import { attachObjectToProject } from '@/lib/projects/object-attachment';

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
const RADIUS_SMALL = '12px';

export function NewProjectDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const isOpen = activeContent === 'new-project';
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const { refreshWorkspaces } = useWorkspace();

  const template = drawerData?.template;
  const onSuccess = drawerData?.onCreated as ((project: any) => void) | undefined;

  const [ownedProjectsCount, setOwnedProjectsCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && user?.$id) {
      ProjectsService.listProjects(true).then((res) => {
        const owned = (res.rows || []).filter((p: any) => p.ownerId === user.$id).length;
        setOwnedProjectsCount(owned);
      }).catch(() => {});
    } else if (!isOpen) {
      setOwnedProjectsCount(null);
    }
  }, [isOpen, user?.$id]);



  const [step, setStep] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisibilityDrawerOpen, setIsVisibilityDrawerOpen] = useState(false);
  
  // Resources for picking
  const [resources, setResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  // Form State
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('public');
  const [isGuest, setIsGuest] = useState(true);
  const [isGuestExpanded, setIsGuestExpanded] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!user?.$id) return;
    setLoadingResources(true);
    try {
        if (template?.id === 'form-to-project' || template?.id === 'service-desk' || template?.id === 'event-command-center') {
            const res = await FormsService.listUserForms(user.$id);
            setResources(res?.rows || []);
        } else if (template?.id === 'idea-to-execution' || template?.id === 'wiki-knowledge-hub' || template?.id === 'product-roadmap') {
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
      setIsExpanded(false);
      setIsGuest(true);
      setIsGuestExpanded(false);

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
        createdAt: new Date().toISOString()};

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
        isGuest: visibility === 'public' ? isGuest : false,
        status: 'active',
        metadata: JSON.stringify(metadata)
      } as any);

      // 3. Post-Creation Magic (Under the hood)
      if (selectedResourceId) {
          const resourceKind = (template?.id === 'form-to-project' || template?.id === 'service-desk' || template?.id === 'event-command-center') ? 'form' : 'note';
          
          // Link Resource
          await attachObjectToProject({
            projectId: project.$id,
            entityKind: resourceKind,
            entityId: selectedResourceId});
          
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

      showSuccess('Workspace created');
      void refreshWorkspaces();
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

  const mainFormContent = (
    <Box
      sx={{
        px: { xs: 2.25, sm: 2.75 },
        pb: 'max(20px, env(safe-area-inset-bottom))',
        pt: isDesktop ? 2.5 : 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: SURFACE_ASH
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: RADIUS_SMALL,
              display: 'grid',
              placeItems: 'center',
              bgcolor: VOID,
              border: BORDER,
              flexShrink: 0}}
          >
            {template?.icon ? <template.icon size={20} color={template.color} strokeWidth={2.5} /> : <ProjectIcon size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
              <Typography component="span" sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: fontDisplay, letterSpacing: '-0.02em', lineHeight: 1.25 }} noWrap>
                  {template?.title || 'New Workspace'}
              </Typography>
              <Typography component="span" sx={{ color: TEXT_MUTED, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.65rem', lineHeight: 1.35 }} noWrap>
                  {step === 1 ? 'Step 1: Link Context' : 'Step 2: Finalize Workspace'}
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
            flexShrink: 0,
            ml: 2}}
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
          gap: 2,
          overflowY: 'auto',
          pr: 0.5
        }}
      >
        {step === 1 && (
            <Box>
                <Typography component="span" sx={{ fontWeight: 800, color: TEXT_MUTED, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', lineHeight: 1.35 }}>
                    Select existing {template?.id?.includes('form') ? 'Form' : 'Note'} to link
                </Typography>
                
                {loadingResources ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} sx={{ color: SYSTEM_PRIMARY }} />
                  </Box>
                ) : resources.length === 0 ? (
                  <Box sx={{ p: 2, borderRadius: RADIUS_SMALL, bgcolor: VOID, border: BORDER, textAlign: 'center' }}>
                    <Typography component="span" sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                      No {template?.id?.includes('form') ? 'forms' : 'notes'} found. Proceeding without linking.
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
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)'}}
                        >
                          {visibility === 'private' ? <Lock size={16} color={TEXT_MUTED} /> : <Globe size={16} color="#10B981" />}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                          <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25, color: '#fff', textTransform: 'capitalize' }}>
                            {visibility}
                          </Typography>
                          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                            {visibility === 'private' ? 'Only you and collaborators' : 'Public to the ecosystem and guests'}
                          </Typography>
                        </Box>
                      </Box>
                      <ChevronRight size={18} color={TEXT_MUTED} style={{ flexShrink: 0 }} />
                    </Box>
                </Box>

                <Box sx={{ mt: 'auto', pt: 2 }}>
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
                            '&.ob-disabled': { bgcolor: HOVER, color: TEXT_MUTED }
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

      {/* Visibility Selection Sub-Drawer */}
      <Drawer
        anchor="bottom"
        open={isVisibilityDrawerOpen}
        onClose={() => setIsVisibilityDrawerOpen(false)}
        ModalProps={{ keepMounted: false, disableScrollLock: false }}
        sx={{
          '& .ob-drawer-panel': {
            bgcolor: SURFACE_ASH,
            borderTopLeftRadius: RADIUS_LARGE,
            borderTopRightRadius: RADIUS_LARGE,
            border: BORDER,
            borderBottom: 0,
            pb: 'max(24px, env(safe-area-inset-bottom))',
            pt: 2,
            px: { xs: 2.25, sm: 2.75 }}
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography component="span" sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: fontDisplay, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Project Visibility
          </Typography>
          <IconButton
            onClick={() => setIsVisibilityDrawerOpen(false)}
            sx={{
              color: '#E8E6E3',
              bgcolor: VOID,
              border: BORDER,
              '&:hover': { bgcolor: HOVER },
              flexShrink: 0}}
          >
            <CloseIcon size={18} />
          </IconButton>
        </Stack>

        <Stack spacing={2}>
          {[
            { id: 'private', label: 'Private', desc: 'Only you and explicitly added collaborators can access.', icon: Lock, color: TEXT_MUTED },
            { id: 'public', label: 'Public', desc: 'Visible and searchable to the entire ecosystem and guests.', icon: Globe, color: '#10B981' }
          ].map((opt) => {
            const isSelected = visibility === opt.id;
            return (
              <Box
                key={opt.id}
                component="button"
                type="button"
                onClick={() => {
                  setVisibility(opt.id as any);
                  if (opt.id === 'public') {
                    setIsGuest(true);
                    setIsGuestExpanded(false);
                  } else {
                    setIsVisibilityDrawerOpen(false);
                  }
                }}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.25,
                  py: 1.75,
                  borderRadius: '16px',
                  bgcolor: isSelected ? 'rgba(99, 102, 241, 0.05)' : VOID,
                  border: isSelected ? `1px solid ${SYSTEM_PRIMARY}` : BORDER,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: BRAND_TRANSITION,
                  '&:hover': { borderColor: isSelected ? SYSTEM_PRIMARY : '#4F4C49', bgcolor: isSelected ? 'rgba(99, 102, 241, 0.08)' : HOVER }}}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)'}}
                >
                  <opt.icon size={18} color={opt.color} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                  <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25, color: '#fff' }}>
                    {opt.label}
                  </Typography>
                  <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.76rem', lineHeight: 1.35 }} noWrap>
                    {opt.desc}
                  </Typography>
                </Box>
                {isSelected && <Check size={20} color={SYSTEM_PRIMARY} style={{ flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Stack>

        {visibility === 'public' && (
          <Box sx={{ border: BORDER, borderRadius: '16px', bgcolor: VOID, overflow: 'hidden', mt: 2 }}>
            <Box
              component="button"
              type="button"
              onClick={() => setIsGuestExpanded(!isGuestExpanded)}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                bgcolor: 'transparent',
                border: 0,
                cursor: 'pointer',
                color: TEXT_MUTED,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' }
              }}
            >
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: fontDisplay }}>
                Advanced Access Control
              </Typography>
              {isGuestExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Box>

            {isGuestExpanded && (
              <Box sx={{ p: 2, pt: 0, borderTop: `1px solid ${BORDER_HAIRLINE}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifySpace: 'space-between', gap: 2, mt: 2 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#fff', display: 'block' }}>
                      Anonymous Guest View
                    </Typography>
                    <Typography component="span" sx={{ fontSize: '0.68rem', color: TEXT_MUTED, display: 'block', mt: 0.5, maxWidth: 280, lineHeight: 1.4 }}>
                      Allow anyone with the link to read project details without registering.
                    </Typography>
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setIsGuest(!isGuest)}
                    sx={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      p: '2px',
                      border: 0,
                      cursor: 'pointer',
                      bgcolor: isGuest ? SYSTEM_PRIMARY : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'background-color 0.2s'}}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: '#fff',
                        boxShadow: 2,
                        transform: isGuest ? 'translateX(20px)' : 'translateX(0px)',
                        transition: 'transform 0.2s'}}
                    />
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {visibility === 'public' && (
          <Button
            fullWidth
            onClick={() => setIsVisibilityDrawerOpen(false)}
            sx={{
              mt: 3,
              bgcolor: SYSTEM_PRIMARY,
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.88rem',
              py: 1.5,
              borderRadius: RADIUS_SMALL,
              textTransform: 'none',
              '&:hover': { bgcolor: SYSTEM_HOVER }
            }}
          >
            Confirm Visibility
          </Button>
        )}
      </Drawer>
    </Drawer>
  );
}
