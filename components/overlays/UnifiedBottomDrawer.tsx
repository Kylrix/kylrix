'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Drawer, useTheme, useMediaQuery } from '@mui/material';
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
const GoogleIntegrationDrawer = dynamic(() => import('./GoogleIntegrationDrawer').then(mod => mod.GoogleIntegrationDrawer), { ssr: false });
const GithubIntegrationDrawer = dynamic(() => import('./GithubIntegrationDrawer').then(mod => mod.GithubIntegrationDrawer), { ssr: false });

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
            return <AssignGoalDrawer 
                isOpen={true} 
                onClose={close} 
                taskId={drawerData?.taskId} 
                taskTitle={drawerData?.taskTitle} 
            />;
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
        case 'google-integration':
            return <GoogleIntegrationDrawer isOpen={true} onClose={close} />;
        case 'github-integration':
            return <GithubIntegrationDrawer isOpen={true} onClose={close} />;
        default: return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  // Some components handle their own Drawer wrapper, but for new simple ones we wrap them
  if (['secure-chat-setup', 'delete-confirm', 'project-invite', 'form'].includes(activeContent)) {
    return (
        <Drawer
            anchor={isDesktop ? 'right' : 'bottom'}
            open={true}
            onClose={close}
            ModalProps={{ keepMounted: false, disablePortal: true }}
            PaperProps={{
                sx: {
                    bgcolor: '#161412',
                    ...(isDesktop ? {
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                        height: '100%',
                        maxWidth: 480,
                        width: '100%'
                    } : {
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '32px 32px 0 0',
                        maxHeight: activeContent === 'form' ? '60dvh' : '90dvh',
                    }),
                    overflow: 'hidden'
                }
            }}
        >
            {content}
        </Drawer>
    );
  }

  return content;
}
