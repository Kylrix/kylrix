'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Drawer, useTheme, useMediaQuery, Box } from '@/lib/mui-tailwind/material';
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
const NewProjectDrawer = dynamic(() => import('./NewProjectDrawer').then(mod => mod.NewProjectDrawer), { ssr: false });
const SecureChatSetupDrawer = dynamic(() => import('./SecureChatSetupDrawer').then(mod => mod.SecureChatSetupDrawer), { ssr: false });
const DeleteConfirmDrawer = dynamic(() => import('./DeleteConfirmDrawer').then(mod => mod.DeleteConfirmDrawer), { ssr: false });
const ProjectInviteDrawer = dynamic(() => import('./ProjectInviteDrawer').then(mod => mod.ProjectInviteDrawer), { ssr: false });
const UnifiedFormContent = dynamic(() => import('../forms/UnifiedFormContent').then(mod => mod.UnifiedFormContent), { ssr: false });
const GithubIntegrationDrawer = dynamic(() => import('./GithubIntegrationDrawer').then(mod => mod.GithubIntegrationDrawer), { ssr: false });
const TaskAddToProjectDrawerHost = dynamic(() => import('./TaskAddToProjectDrawer').then(mod => mod.TaskAddToProjectDrawerHost), { ssr: false });

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
            return <NewChatDrawer isOpen={true} onClose={close} />;
        case 'new-channel':
            return <NewChannelDrawer isOpen={true} onClose={close} />;
        case 'secure-chat-setup':
            return <SecureChatSetupDrawer />;
        case 'delete-confirm':
            return <DeleteConfirmDrawer />;
        case 'project-invite':
            return <ProjectInviteDrawer />;
        case 'form':
            return <UnifiedFormContent 
                formId={drawerData?.formId} 
                onClose={close} 
            />;
        case 'github-integration':
            return <GithubIntegrationDrawer isOpen={true} onClose={close} {...drawerData} />;
        default: return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  // Authoritative Drawer Wrapper with Rigid Viewport Isolation
  if (['secure-chat-setup', 'delete-confirm', 'project-invite'].includes(activeContent)) {
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
                            maxHeight: activeContent === 'form' ? '60dvh' : '90dvh',
                            overflow: 'hidden'
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
                            overflow: 'hidden'
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
