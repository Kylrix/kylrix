'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Drawer, useTheme, useMediaQuery, Box } from '@/lib/openbricks/primitives';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

// Import all dynamic drawer components
const LoginDrawer = dynamic(() => import('./LoginDrawer').then(mod => mod.LoginDrawer), { ssr: false });
const AgenticDrawer = dynamic(() => import('./AgenticDrawer').then(mod => mod.AgenticDrawer), { ssr: false });
const NoteDrawer = dynamic(() => import('./NoteDrawer').then(mod => mod.NoteDrawer), { ssr: false });
const ShareNoteDrawer = dynamic(() => import('./ShareNoteDrawer').then(mod => mod.ShareNoteDrawer), { ssr: false });
const AssignGoalDrawer = dynamic(() => import('./AssignGoalDrawer').then(mod => mod.AssignGoalDrawer), { ssr: false });
const DeleteNoteDrawer = dynamic(() => import('./DeleteNoteDrawer').then(mod => mod.DeleteNoteDrawer), { ssr: false });

const NewChatDrawer = dynamic(() => import('./NewChatDrawer').then(mod => mod.NewChatDrawer), { ssr: false });
const NewChannelDrawer = dynamic(() => import('./NewChannelDrawer').then(mod => mod.NewChannelDrawer), { ssr: false });
const NewTagDrawer = dynamic(() => import('./NewTagDrawer').then(mod => mod.NewTagDrawer), { ssr: false });
const TagSelectorDrawer = dynamic(() => import('./TagSelectorDrawer').then(mod => mod.TagSelectorDrawer), { ssr: false });
const NewProjectDrawer = dynamic(() => import('./NewProjectDrawer').then(mod => mod.NewProjectDrawer), { ssr: false });
const SecureChatSetupDrawer = dynamic(() => import('./SecureChatSetupDrawer').then(mod => mod.SecureChatSetupDrawer), { ssr: false });
const PasskeySetupPanel = dynamic(() => import('./PasskeySetup').then(mod => mod.PasskeySetupPanel), { ssr: false });
const DeleteConfirmDrawer = dynamic(() => import('./DeleteConfirmDrawer').then(mod => mod.DeleteConfirmDrawer), { ssr: false });
const SecurityConfirmDrawer = dynamic(() => import('./SecurityConfirmDrawer').then(mod => mod.SecurityConfirmDrawer), { ssr: false });
const ProjectInviteDrawer = dynamic(() => import('./ProjectInviteDrawer').then(mod => mod.ProjectInviteDrawer), { ssr: false });
const UnifiedFormContent = dynamic(() => import('../forms/UnifiedFormContent').then(mod => mod.UnifiedFormContent), { ssr: false });
const GithubIntegrationDrawer = dynamic(() => import('./GithubIntegrationDrawer').then(mod => mod.GithubIntegrationDrawer), { ssr: false });
const TaskAddToProjectDrawerHost = dynamic(() => import('./TaskAddToProjectDrawer').then(mod => mod.TaskAddToProjectDrawerHost), { ssr: false });
const ResponseDetailDrawer = dynamic(() => import('../forms/ResponseDetailDrawer').then(mod => mod.ResponseDetailDrawer), { ssr: false });
const MomentComposerDrawer = dynamic(() => import('./MomentComposerDrawer').then(mod => mod.MomentComposerDrawer), { ssr: false });
const ProjectSettingsDrawer = dynamic(() => import('../projects/ProjectSettingsDrawer'), { ssr: false });
const ProjectVisibilityDrawer = dynamic(() => import('../projects/ProjectVisibilityDrawer'), { ssr: false });
const ProjectAutoSweepDrawer = dynamic(() => import('../projects/ProjectAutoSweepDrawer'), { ssr: false });
const JoinRequestConfirmDrawer = dynamic(() => import('./JoinRequestConfirmDrawer').then(mod => mod.JoinRequestConfirmDrawer), { ssr: false });

export function UnifiedBottomDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const renderContent = () => {
    switch (activeContent) {
        case 'login': return <LoginDrawer />;
        case 'agentic': return <AgenticDrawer />;
        case 'note': return <NoteDrawer />;
        case 'new-tag': return <NewTagDrawer />;
        case 'tag-selector': return <TagSelectorDrawer />;
        case 'new-project': return <NewProjectDrawer />;
        case 'share-note': 
            return <ShareNoteDrawer 
                isOpen={true} 
                onClose={close} 
                noteId={drawerData?.noteId || drawerData?.resourceId} 
                noteTitle={drawerData?.noteTitle || drawerData?.resourceTitle} 
                resourceType={drawerData?.resourceType || 'note'}
            />;
        case 'assign-goal':
            return <ShareNoteDrawer 
                isOpen={true} 
                onClose={close} 
                noteId={drawerData?.taskId || drawerData?.resourceId} 
                noteTitle={drawerData?.taskTitle || drawerData?.resourceTitle} 
                resourceType="goal"
            />;
        case 'task-add-to-project':
            return <TaskAddToProjectDrawerHost />;
        case 'delete-note':
            return <DeleteNoteDrawer 
                isOpen={true} 
                onClose={close} 
                onConfirm={drawerData?.onConfirm} 
                noteTitle={drawerData?.noteTitle} 
            />;
        case 'new-chat':
            return <NewChatDrawer isOpen={true} onClose={close} mode={drawerData?.mode} />;
        case 'new-channel':
            return <NewChannelDrawer isOpen={true} onClose={close} />;
        case 'secure-chat-setup':
            return <SecureChatSetupDrawer />;
        case 'passkey-setup':
            return (
                <PasskeySetupPanel
                    onClose={close}
                    userId={drawerData?.userId || ''}
                    onSuccess={() => {
                        drawerData?.onSuccess?.();
                        close();
                    }}
                    trustUnlocked={drawerData?.trustUnlocked ?? true}
                />
            );
        case 'delete-confirm':
            return <DeleteConfirmDrawer />;
        case 'security-confirm':
            return <SecurityConfirmDrawer />;
        case 'project-invite':
            return <ProjectInviteDrawer />;
        case 'form':
            return <UnifiedFormContent 
                formId={drawerData?.formId} 
                onClose={close} 
            />;
        case 'form-response-detail':
            return <ResponseDetailDrawer 
                isOpen={true}
                onClose={close}
                submission={drawerData?.submission}
                schemaMap={drawerData?.schemaMap}
            />;
        case 'github-integration':
            return <GithubIntegrationDrawer isOpen={true} onClose={close} {...drawerData} />;
        case 'project-settings':
            return <ProjectSettingsDrawer isOpen={true} onClose={close} project={drawerData?.project} onSave={drawerData?.onSave} />;
        case 'project-visibility':
            return <ProjectVisibilityDrawer isOpen={true} onClose={close} project={drawerData?.project} onSave={drawerData?.onSave} />;
        case 'project-auto-sweep':
            return (
              <ProjectAutoSweepDrawer
                isOpen={true}
                onClose={close}
                projectId={drawerData?.projectId as string}
                projectTitle={drawerData?.projectTitle as string}
                onSaved={drawerData?.onSaved}
              />
            );
        case 'moment-composer':
            return <MomentComposerDrawer onClose={close} />;
        case 'project-join-request-confirm':
            return <JoinRequestConfirmDrawer />;
        default: return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  // Authoritative Drawer Wrapper with Rigid Viewport Isolation
  if (['secure-chat-setup', 'passkey-setup', 'delete-confirm', 'security-confirm', 'project-invite', 'project-join-request-confirm'].includes(activeContent)) {
    return (
        <>
            {/* Mobile-Only Authoritative Bottom Drawer */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Drawer
                    anchor="bottom"
                    open={true}
                    onClose={close}
                    ModalProps={{ keepMounted: false }}
                    PaperProps={{
                        sx: {
                            bgcolor: '#161412',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '32px 32px 0 0',
                            maxHeight: '90dvh',
                            overflowY: 'auto'
                        }
                    }}
                >
                    {content}
                </Drawer>
            </Box>

            {/* Desktop-Only Authoritative Right Sidepanel */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Drawer
                    anchor="right"
                    open={true}
                    onClose={close}
                    ModalProps={{ keepMounted: false }}
                    PaperProps={{
                        sx: {
                            bgcolor: '#161412',
                            borderLeft: '1px solid rgba(255,255,255,0.08)',
                            height: '100%',
                            maxWidth: 480,
                            width: '100%',
                            overflowY: 'auto'
                        }
                    }}
                >
                    {content}
                </Drawer>
            </Box>
        </>
    );
  } else if (activeContent === 'form-response-detail') {
    return (
        <>
            {/* Mobile-Only Full Screen Overlay View */}
            <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'fixed', inset: 0, zIndex: 10001, bgcolor: '#000', overflowY: 'auto' }}>
                {content}
            </Box>

            {/* Desktop-Only Authoritative Right Sidepanel */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Drawer
                    anchor="right"
                    open={true}
                    onClose={close}
                    ModalProps={{ keepMounted: false }}
                    PaperProps={{
                        sx: {
                            bgcolor: '#161412',
                            borderLeft: '1px solid rgba(255,255,255,0.08)',
                            height: '100%',
                            maxWidth: 480,
                            width: '100%',
                            overflowY: 'auto'
                        }
                    }}
                >
                    {content}
                </Drawer>
            </Box>
        </>
    );
  }

  return content;
}
