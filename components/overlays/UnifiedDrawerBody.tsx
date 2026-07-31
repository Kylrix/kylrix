'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { DrawerContent } from '@/context/UnifiedDrawerContext';

const LoginDrawer = dynamic(() => import('./LoginDrawer').then((m) => m.LoginDrawer), { ssr: false });
const NoteDrawer = dynamic(() => import('./NoteDrawer').then((m) => m.NoteDrawer), { ssr: false });
const ShareNoteDrawer = dynamic(() => import('./ShareNoteDrawer').then((m) => m.ShareNoteDrawer), {
  ssr: false,
});
const DeleteNoteDrawer = dynamic(() => import('./DeleteNoteDrawer').then((m) => m.DeleteNoteDrawer), {
  ssr: false,
});
const NewChatDrawer = dynamic(() => import('./NewChatDrawer').then((m) => m.NewChatDrawer), {
  ssr: false,
});
const NewChannelDrawer = dynamic(() => import('./NewChannelDrawer').then((m) => m.NewChannelDrawer), {
  ssr: false,
});
const NewTagDrawer = dynamic(() => import('./NewTagDrawer').then((m) => m.NewTagDrawer), {
  ssr: false,
});
const TagSelectorDrawer = dynamic(() => import('./TagSelectorDrawer').then((m) => m.TagSelectorDrawer), {
  ssr: false,
});
const NewProjectDrawer = dynamic(() => import('./NewProjectDrawer').then((m) => m.NewProjectDrawer), {
  ssr: false,
});
const AgentCreateDrawer = dynamic(() => import('./AgentCreateDrawer').then((m) => m.AgentCreateDrawer), {
  ssr: false,
});
const SecureChatSetupDrawer = dynamic(
  () => import('./SecureChatSetupDrawer').then((m) => m.SecureChatSetupDrawer),
  { ssr: false },
);
const PasskeySetupPanel = dynamic(() => import('./PasskeySetup').then((m) => m.PasskeySetupPanel), {
  ssr: false,
});
const DeleteConfirmDrawer = dynamic(
  () => import('./DeleteConfirmDrawer').then((m) => m.DeleteConfirmDrawer),
  { ssr: false },
);
const SecurityConfirmDrawer = dynamic(
  () => import('./SecurityConfirmDrawer').then((m) => m.SecurityConfirmDrawer),
  { ssr: false },
);
const ProjectInviteDrawer = dynamic(
  () => import('./ProjectInviteDrawer').then((m) => m.ProjectInviteDrawer),
  { ssr: false },
);
const UnifiedFormContent = dynamic(
  () => import('../forms/UnifiedFormContent').then((m) => m.UnifiedFormContent),
  { ssr: false },
);
const TaskAddToProjectDrawerHost = dynamic(
  () => import('./TaskAddToProjectDrawer').then((m) => m.TaskAddToProjectDrawerHost),
  { ssr: false },
);
const ResponseDetailDrawer = dynamic(
  () => import('../forms/ResponseDetailDrawer').then((m) => m.ResponseDetailDrawer),
  { ssr: false },
);
const AgenticPreviewDrawer = dynamic(
  () => import('../agentic/AgenticPreviewDrawer').then((m) => m.AgenticPreviewDrawer),
  { ssr: false },
);
const MomentComposerDrawer = dynamic(
  () => import('./MomentComposerDrawer').then((m) => m.MomentComposerDrawer),
  { ssr: false },
);
const ProjectSettingsDrawer = dynamic(() => import('../projects/ProjectSettingsDrawer'), { ssr: false });
const ProjectVisibilityDrawer = dynamic(() => import('../projects/ProjectVisibilityDrawer'), {
  ssr: false,
});
const ProjectAutoSweepDrawer = dynamic(() => import('../projects/ProjectAutoSweepDrawer'), {
  ssr: false,
});
const JoinRequestConfirmDrawer = dynamic(
  () => import('./JoinRequestConfirmDrawer').then((m) => m.JoinRequestConfirmDrawer),
  { ssr: false },
);
const AccessControlDrawer = dynamic(
  () => import('./AccessControlDrawer').then((m) => m.AccessControlDrawer),
  { ssr: false },
);
const TaskDetails = dynamic(() => import('../tasks/TaskDetails'), { ssr: false });
const AgenticPanelContent = dynamic(
  () => import('./AgenticPanelContent').then((m) => m.AgenticPanelContent),
  { ssr: false },
);

export function unifiedDrawerWidth(content: DrawerContent): number {
  switch (content) {
    case 'delete-confirm':
    case 'delete-note':
    case 'security-confirm':
    case 'project-join-request-confirm':
      return 400;
    case 'form':
    case 'form-response-detail':
    case 'milestone-details':
    case 'agentic-preview':
      return 560;
    case 'agentic':
      return 440;
    default:
      return 420;
  }
}

/** Surfaces that stay as true modal overlays (auth). */
export function isUnifiedOverlayOnly(content: DrawerContent): boolean {
  return content === 'navbar' || content === 'login';
}

type Props = {
  activeContent: DrawerContent;
  drawerData: any;
  onClose: () => void;
};

/** Shared body for bottom-drawer legacy + native sidebar host. */
export function UnifiedDrawerBody({ activeContent, drawerData, onClose }: Props) {
  switch (activeContent) {
    case 'login':
      return <LoginDrawer />;
    case 'agentic':
      return (
        <AgenticPanelContent
          isDesktop
          onClose={onClose}
        />
      );
    case 'note':
      return <NoteDrawer />;
    case 'new-tag':
      return <NewTagDrawer />;
    case 'tag-selector':
      return <TagSelectorDrawer />;
    case 'new-project':
      return <NewProjectDrawer />;
    case 'agent-create':
      return <AgentCreateDrawer />;
    case 'share-note':
      return (
        <ShareNoteDrawer
          isOpen
          onClose={onClose}
          noteId={drawerData?.noteId || drawerData?.resourceId}
          noteTitle={drawerData?.noteTitle || drawerData?.resourceTitle}
          resourceType={drawerData?.resourceType || 'note'}
        />
      );
    case 'assign-goal':
      return (
        <ShareNoteDrawer
          isOpen
          onClose={onClose}
          noteId={drawerData?.taskId || drawerData?.resourceId}
          noteTitle={drawerData?.taskTitle || drawerData?.resourceTitle}
          resourceType="goal"
        />
      );
    case 'task-add-to-project':
      return <TaskAddToProjectDrawerHost />;
    case 'delete-note':
      return (
        <DeleteNoteDrawer
          isOpen
          onClose={onClose}
          onConfirm={drawerData?.onConfirm}
          noteTitle={drawerData?.noteTitle}
        />
      );
    case 'new-chat':
      return <NewChatDrawer isOpen onClose={onClose} mode={drawerData?.mode} />;
    case 'new-channel':
      return <NewChannelDrawer isOpen onClose={onClose} />;
    case 'secure-chat-setup':
      return <SecureChatSetupDrawer />;
    case 'passkey-setup':
      return (
        <PasskeySetupPanel
          onClose={onClose}
          userId={drawerData?.userId || ''}
          onSuccess={() => {
            drawerData?.onSuccess?.();
            onClose();
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
      return <UnifiedFormContent formId={drawerData?.formId} onClose={onClose} />;
    case 'form-response-detail':
      return (
        <ResponseDetailDrawer
          isOpen
          onClose={onClose}
          submission={drawerData?.submission}
          schemaMap={drawerData?.schemaMap}
        />
      );
    case 'agentic-preview':
      return (
        <AgenticPreviewDrawer
          previewId={String(drawerData?.previewId || '')}
          kind={drawerData?.kind as string | undefined}
          title={drawerData?.title as string | undefined}
          onClose={onClose}
          onCommitted={drawerData?.onCommitted as (() => void) | undefined}
        />
      );
    case 'project-settings':
      return (
        <ProjectSettingsDrawer
          isOpen
          onClose={onClose}
          project={drawerData?.project}
          onSave={drawerData?.onSave}
        />
      );
    case 'project-visibility':
      return (
        <ProjectVisibilityDrawer
          isOpen
          onClose={onClose}
          project={drawerData?.project}
          onSave={drawerData?.onSave}
        />
      );
    case 'project-auto-sweep':
      return (
        <ProjectAutoSweepDrawer
          isOpen
          onClose={onClose}
          projectId={drawerData?.projectId as string}
          projectTitle={drawerData?.projectTitle as string}
          onSaved={drawerData?.onSaved}
        />
      );
    case 'moment-composer':
      return <MomentComposerDrawer onClose={onClose} />;
    case 'project-join-request-confirm':
      return <JoinRequestConfirmDrawer />;
    case 'access-control':
      return (
        <AccessControlDrawer
          isOpen
          onClose={onClose}
          resourceType={drawerData?.resourceType}
          resourceId={drawerData?.resourceId}
          isPublic={drawerData?.isPublic}
          isGuest={drawerData?.isGuest}
          resourceTitle={drawerData?.resourceTitle}
          projectId={drawerData?.projectId}
          onUpdate={drawerData?.onUpdate}
        />
      );
    case 'milestone-details':
      return <TaskDetails taskId={drawerData?.taskId} onBack={onClose} />;
    default:
      return null;
  }
}
