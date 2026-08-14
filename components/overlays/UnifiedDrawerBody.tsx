'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Trash2, X } from 'lucide-react';
import type { DrawerContent } from '@/context/UnifiedDrawerContext';

const LoginDrawer = dynamic(() => import('./LoginDrawer').then((m) => m.LoginDrawer), { ssr: false });
const NoteDrawer = dynamic(() => import('./NoteDrawer').then((m) => m.NoteDrawer), { ssr: false });
const ShareNoteDrawer = dynamic(() => import('./ShareNoteDrawer').then((m) => m.ShareNoteDrawer), {
  ssr: false,
});
const DeleteNoteDrawer = dynamic(() => import('./DeleteNoteDrawer').then((m) => m.DeleteNoteDrawer), {
  ssr: false,
});
const ChatCreateDrawer = dynamic(
  () => import('@/components/objects/ChatCreateDrawer').then((m) => m.ChatCreateDrawer),
  { ssr: false },
);
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
const ProfilePreviewDrawer = dynamic(
  () => import('./ProfilePreviewDrawer').then((m) => m.ProfilePreviewDrawer),
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
const EcosystemSendDrawer = dynamic(
  () => import('./EcosystemSendDrawer').then((m) => m.EcosystemSendDrawer),
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

/** Surfaces that stay as true modal overlays (auth + bottom-sheet composers). */
export function isUnifiedOverlayOnly(content: DrawerContent): boolean {
  return (
    content === 'navbar' ||
    content === 'login' ||
    content === 'moment-composer' ||
    content === 'new-chat' ||
    content === 'note'  // NoteDrawer manages its own sidebar + overlay — no Drawer shell needed
  );
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
    case 'delete-confirm':
      return (
        <div className="px-6 pb-6 pt-3 bg-[#161412] flex flex-col justify-between gap-5 select-none">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-red-500/20 bg-[#0A0908] text-red-400">
                  <Trash2 size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-white text-base font-clash leading-tight truncate">
                    {drawerData?.title || 'Move to Trash?'}
                  </h3>
                  <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider block mt-0.5">
                    Permanent Action Confirmation
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/8 text-white/40 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Description Well */}
            <div className="p-4 bg-[#0A0908] border border-white/6 rounded-2xl">
              <p className="text-white/70 text-xs font-satoshi leading-relaxed">
                {drawerData?.description || `Are you sure you want to delete ${drawerData?.resourceName || 'this item'}? Trashed items can be restored anytime from Trash.`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/8 bg-[#0A0908] hover:bg-[#1C1A18] text-white font-satoshi font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await drawerData?.onConfirm?.();
                } finally {
                  onClose();
                }
              }}
              className="flex-1 py-3 rounded-xl border border-red-500/30 bg-red-600 hover:bg-red-700 text-white font-satoshi font-bold text-xs transition-all shadow-[0_4px_16px_rgba(220,38,38,0.3)] cursor-pointer"
            >
              {drawerData?.confirmLabel || 'Confirm Delete'}
            </button>
          </div>
        </div>
      );
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
      return (
        <ChatCreateDrawer
          open
          onClose={onClose}
          legacyMode={drawerData?.mode === 'thread' || drawerData?.mode === 'secure' ? drawerData.mode : undefined}
          initialMode={drawerData?.mode === 'hangout' ? 'hangout' : 'chat'}
        />
      );
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
    case 'ecosystem-send':
      return (
        <EcosystemSendDrawer
          isOpen
          onClose={onClose}
          resourceType={drawerData?.resourceType}
          resourceId={drawerData?.resourceId}
          resourceTitle={drawerData?.resourceTitle}
          kind={drawerData?.kind}
          isPublic={drawerData?.isPublic}
          isGuest={drawerData?.isGuest}
          projectId={drawerData?.projectId}
          resolveShareUrl={drawerData?.resolveShareUrl}
          onUpdate={drawerData?.onUpdate}
        />
      );
    case 'milestone-details':
      return <TaskDetails taskId={drawerData?.taskId} onBack={onClose} />;
    case 'profile-preview':
      return (
        <ProfilePreviewDrawer
          isOpen
          onClose={onClose}
          userId={drawerData?.userId}
          username={drawerData?.username}
          name={drawerData?.name}
          avatar={drawerData?.avatar}
          npub={drawerData?.npub}
          pubkey={drawerData?.pubkey}
          bio={drawerData?.bio}
          source={drawerData?.source}
        />
      );
    default:
      return null;
  }
}
