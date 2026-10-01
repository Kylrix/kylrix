'use client';

import React, { useState } from 'react';
import { Settings, UserPlus, Link2, LogOut, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ID } from 'appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/auth/AuthContext';
import { ProjectsService } from '@/lib/appwrite/projects';

interface WorkspaceOptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: any;
}

export function WorkspaceOptionsDrawer({
  isOpen,
  onClose,
  workspace,
}: WorkspaceOptionsDrawerProps) {
  const { open: openDrawer } = useUnifiedDrawer();
  const { removeSharedWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!isOpen || !workspace) return null;

  const userId = user?.$id || 'guest';
  const wsId = workspace.$id || workspace.id || '';
  const wsTitle = workspace.title || workspace.name || 'Untitled Workspace';
  const ownerId = workspace.ownerId || workspace.userId || '';
  const isOwner = !ownerId || ownerId === userId || userId === 'guest';
  const isShared = Boolean(workspace.isShared || (!isOwner && !workspace.isPersonal));

  const handleCopyInviteLink = async () => {
    let code = workspace.inviteCode;
    if (!code) {
      code = ID.unique();
      workspace.inviteCode = code;
      void ProjectsService.rotateInviteCode(wsId, code).catch((err) => {
        console.warn('[WorkspaceOptionsDrawer] Failed to sync generated inviteCode:', err);
      });
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.kylrix.space';
    const inviteUrl = `${origin}/workspace/${wsId}/${code}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Workspace invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy invite link');
    }
  };

  const handleRemoveFromMyWorkspaces = async () => {
    setRemoving(true);
    try {
      await removeSharedWorkspace(wsId);
      toast.success(`Removed "${wsTitle}" from your workspaces`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove workspace');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#161412] border-t-2 sm:border-2 border-white/20 rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 duration-250 font-satoshi"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-black text-white font-clash truncate m-0">
              {wsTitle}
            </h3>
            <p className="text-[11px] text-white/40 mt-0.5 truncate m-0">
              {isShared ? 'Shared Workspace' : 'Personal & Owned Workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {/* 1. Workspace Settings */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openDrawer('project-settings', { project: workspace });
            }}
            className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <Settings size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white font-clash">Workspace Settings</div>
              <div className="text-[11px] text-white/40 truncate">Title, description, visibility, and API keys</div>
            </div>
          </button>

          {/* 2. Share Workspace */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openDrawer('share-note', {
                resourceType: 'project',
                resourceId: wsId,
                resourceTitle: wsTitle,
              });
            }}
            className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <UserPlus size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white font-clash">Share Workspace</div>
              <div className="text-[11px] text-white/40 truncate">Manage members and collaborator permissions</div>
            </div>
          </button>

          {/* 3. Copy Invite Link */}
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              {copied ? <Check size={16} /> : <Link2 size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white font-clash flex items-center gap-2">
                <span>Copy Invite Link</span>
                {copied && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">Copied!</span>
                )}
              </div>
              <div className="text-[11px] text-white/40 truncate">Instant auto-join link for collaborators</div>
            </div>
          </button>

          {/* 4. Remove from My Workspaces (only shown for non-owned shared workspaces) */}
          {isShared && (
            <button
              type="button"
              disabled={removing}
              onClick={handleRemoveFromMyWorkspaces}
              className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all text-left cursor-pointer group disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
                <LogOut size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-rose-400 font-clash">
                  {removing ? 'Removing...' : 'Remove from My Workspaces'}
                </div>
                <div className="text-[11px] text-rose-300/60 truncate">Leave workspace and purge locally cached data</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceOptionsDrawer;
