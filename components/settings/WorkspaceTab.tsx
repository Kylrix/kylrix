'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderKanban, 
  UserPlus, 
  UserMinus, 
  Globe, 
  Lock, 
  Archive, 
  Trash2, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  KeyRound,
  Plus,
  Code2,
  Clock,
  UserCheck
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { Projects } from '@/types/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { toast } from 'react-hot-toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { listPats, revokePat } from '@/lib/actions/client-ops';
import { CreatePatDrawer } from '@/components/settings/CreatePatDrawer';
import UserSearch from '@/components/UserSearch';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { LocalEngine } from '@/lib/services/LocalEngine';

export function WorkspaceTab({ onGoToDevelopers }: { onGoToDevelopers?: () => void } = {}) {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { user: _user } = useAuth();
  const { open: openDrawer } = useUnifiedDrawer();

  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const [_project, setProject] = useState<Projects | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states initialized optimistically from activeWorkspace
  const [title, setTitle] = useState(activeWorkspace?.title || '');
  const [summary, setSummary] = useState((activeWorkspace as any)?.summary || '');
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    (activeWorkspace as any)?.isPublic ? 'public' : 'private'
  );
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  // Collaborators / Members
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [permissionRole, setPermissionRole] = useState<'member' | 'editor' | 'admin' | 'viewer'>('member');
  const [addingMember, setAddingMember] = useState(false);

  // Workspace Keys
  const [pats, setPats] = useState<any[]>([]);
  const [loadingPats, setLoadingPats] = useState(false);
  const [createPatOpen, setCreatePatOpen] = useState(false);

  const loadWorkspacePats = useCallback(async (wsId: string) => {
    setLoadingPats(true);
    try {
      const res = await listPats({ isWorkspace: true, workspaceId: wsId });
      if (res?.success) setPats(res.data || []);
    } catch {
      setPats([]);
    } finally {
      setLoadingPats(false);
    }
  }, []);

  const handleRevokePat = async (patId: string) => {
    try {
      await revokePat(patId);
      toast.success('Workspace key revoked');
      if (activeWorkspace?.id) void loadWorkspacePats(activeWorkspace.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke key');
    }
  };

  const loadWorkspaceDetails = useCallback(async () => {
    if (!isCustomWorkspace || !activeWorkspace?.id) return;
    setLoading(true);
    const cacheKey = `ws_details_${activeWorkspace.id}`;

    // Check LocalEngine cache first for 0ms hydration
    try {
      const cached = await LocalEngine.cacheGet<any>(cacheKey);
      if (cached) {
        if (cached.project) {
          setProject(cached.project);
          setTitle(cached.project.title || '');
          setSummary(cached.project.summary || '');
          setVisibility(cached.project.visibility === 'public' || cached.project.isPublic ? 'public' : 'private');
          setStatus(cached.project.status === 'archived' ? 'archived' : 'active');
        }
        if (cached.collaborators) {
          setCollaborators(cached.collaborators);
        }
      }
    } catch {}

    try {
      const data = await ProjectsService.getProject(activeWorkspace.id);
      let rows: any[] = [];
      if (data) {
        setProject(data);
        setTitle(data.title || '');
        setSummary(data.summary || '');
        setVisibility(data.visibility === 'public' || data.isPublic ? 'public' : 'private');
        setStatus(data.status === 'archived' ? 'archived' : 'active');
      }

      try {
        const res = await ProjectsService.listProjectCollaborators(activeWorkspace.id);
        rows = res?.rows || [];
        setCollaborators(rows);
      } catch {
        rows = [];
        setCollaborators([]);
      }

      // Cache updated payload in LocalEngine
      void LocalEngine.cacheSet(cacheKey, { project: data, collaborators: rows });
    } catch (err: any) {
      toast.error('Failed to load workspace details: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, isCustomWorkspace]);

  useEffect(() => {
    void loadWorkspaceDetails();
  }, [loadWorkspaceDetails]);

  useEffect(() => {
    if (isCustomWorkspace && activeWorkspace?.id) {
      void loadWorkspacePats(activeWorkspace.id);
    } else {
      setPats([]);
    }
  }, [isCustomWorkspace, activeWorkspace?.id, loadWorkspacePats]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !title.trim()) return;
    setSaving(true);
    try {
      await ProjectsService.updateProject(activeWorkspace.id, {
        title: title.trim(),
        summary: summary.trim(),
        visibility: visibility as any,
        isPublic: visibility === 'public',
        status: status as any,
      });
      toast.success('Workspace updated successfully!');
      void refreshWorkspaces();
      void loadWorkspaceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || selectedUsers.length === 0) return;
    setAddingMember(true);
    try {
      let count = 0;
      for (const targetUser of selectedUsers) {
        const targetId = targetUser.id || targetUser.userId || targetUser.$id || targetUser.email;
        const role = permissionRole === 'viewer' ? 'viewer' : (permissionRole === 'admin' ? 'admin' : 'member');
        await ProjectsService.addCollaborator(activeWorkspace.id, targetId, role);
        count++;
      }
      toast.success(count === 1 ? `Invitation sent to ${selectedUsers[0].title || selectedUsers[0].displayName || selectedUsers[0].id}` : `${count} invitations sent`);
      setSelectedUsers([]);
      void loadWorkspaceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (collabUserId: string) => {
    if (!activeWorkspace?.id) return;
    openDrawer('delete-confirm', {
      title: 'Remove Member?',
      description: 'Are you sure you want to remove this member from the workspace?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        try {
          await ProjectsService.removeCollaborator(activeWorkspace.id, collabUserId);
          toast.success('Member removed');
          void loadWorkspaceDetails();
        } catch (err: any) {
          toast.error(err.message || 'Failed to remove member');
        }
      }
    });
  };

  const handleArchiveWorkspace = async () => {
    if (!activeWorkspace?.id) return;
    const nextStatus = status === 'active' ? 'archived' : 'active';
    openDrawer('delete-confirm', {
      title: nextStatus === 'archived' ? 'Archive Workspace?' : 'Unarchive Workspace?',
      description: nextStatus === 'archived' 
        ? 'Archiving hides the workspace from active navigation while preserving all objects.'
        : 'Unarchiving restores active navigation for this workspace.',
      confirmLabel: nextStatus === 'archived' ? 'Archive' : 'Unarchive',
      onConfirm: async () => {
        try {
          await ProjectsService.updateProject(activeWorkspace.id, { status: nextStatus });
          setStatus(nextStatus);
          toast.success(`Workspace ${nextStatus}`);
          void refreshWorkspaces();
        } catch (err: any) {
          toast.error(err.message || 'Failed to change archive state');
        }
      }
    });
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace?.id) return;
    openDrawer('delete-confirm', {
      title: `Purge Workspace "${activeWorkspace.title}"?`,
      description: 'WARNING: This will permanently delete the workspace and detach its linked objects. This action cannot be undone.',
      confirmLabel: 'Purge Workspace',
      onConfirm: async () => {
        try {
          await ProjectsService.deleteProject(activeWorkspace.id, 'detach');
          toast.success('Workspace deleted successfully');
          void refreshWorkspaces();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete workspace');
        }
      }
    });
  };

  if (!isCustomWorkspace) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto font-satoshi">
        <div className="p-8 md:p-10 text-center rounded-[24px] bg-[#161412] border-2 border-white/20 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0908] border-2 border-white/20 text-white/40 grid place-items-center mx-auto mb-4">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-white mb-1.5 font-clash">Personal Workspace Active</h3>
          <p className="text-xs md:text-sm text-white/50 max-w-md mx-auto mb-6 leading-relaxed">
            You are currently in your default personal workspace. Switch to or create a custom workspace using the top navigation to configure workspace-level settings, members, and access control.
          </p>
        </div>

        {/* Workspace Keys — disabled for personal workspace */}
        <div className="p-6 md:p-8 rounded-[24px] bg-[#161412] border-2 border-white/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white font-clash m-0">Workspace Keys</h2>
              <p className="text-xs text-white/40 mt-0.5 m-0">Tokens scoped exclusively to a specific workspace</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#0A0908] border-2 border-white/20 grid place-items-center text-[#818CF8]">
              <KeyRound size={15} />
            </div>
          </div>

          <div className="p-6 rounded-[20px] bg-[#0A0908] border-2 border-dashed border-white/20 flex flex-col items-center gap-2.5 text-center">
            <div className="w-10 h-10 rounded-2xl bg-[#6366F1]/10 border-2 border-[#6366F1]/30 flex items-center justify-center text-[#818CF8]">
              <KeyRound size={18} />
            </div>
            <p className="text-xs font-bold text-white/80 m-0">Not available in Personal Workspace</p>
            <p className="text-xs text-white/40 max-w-xs leading-relaxed m-0">
              Workspace Keys are created for custom collaborative workspaces. For personal data access, use a Personal Access Token.
            </p>
            <button
              type="button"
              onClick={() => onGoToDevelopers?.()}
              className="mt-2 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-bold transition-all cursor-pointer border-2 border-[#6366F1] shadow-md"
            >
              <Code2 size={13} />
              <span>Go to Settings &rsaquo; Developers</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-satoshi">
      {/* Overview & Metadata */}
      <div className="p-6 md:p-8 rounded-[24px] bg-[#161412] border-2 border-white/20 shadow-xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-white font-clash m-0">Workspace Settings</h2>
              {loading && <RefreshCw size={14} className="animate-spin text-[#6366F1]" />}
            </div>
            <p className="text-xs text-white/40 mt-0.5 m-0">Manage details and visibility for &quot;{activeWorkspace.title}&quot;</p>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
            status === 'active' 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {status}
          </span>
        </div>

        <form onSubmit={handleSaveDetails} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-wider">Workspace Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#0A0908] border-2 border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1] text-xs font-medium transition-colors"
              placeholder="Workspace Name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-wider">Description / Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full p-3.5 rounded-xl bg-[#0A0908] border-2 border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1] text-xs font-medium resize-none transition-colors"
              placeholder="What is this workspace focused on?"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-wider">Visibility Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                  visibility === 'private'
                    ? 'bg-[#6366F1]/10 border-[#6366F1] text-white shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                    : 'bg-[#0A0908] border-white/15 text-white/60 hover:border-white/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30 grid place-items-center shrink-0">
                  <Lock size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white font-clash">Private</div>
                  <div className="text-[11px] text-white/40 mt-0.5 truncate">Only invited collaborators can access</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                  visibility === 'public'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-[#0A0908] border-white/15 text-white/60 hover:border-white/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 grid place-items-center shrink-0">
                  <Globe size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white font-clash">Public</div>
                  <div className="text-[11px] text-white/40 mt-0.5 truncate">Accessible across ecosystem directory</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 h-10 bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer border-2 border-[#6366F1] shadow-md"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? 'Saving...' : 'Save Workspace Changes'}</span>
            </button>
          </div>
        </form>
      </div>


      {/* Members & Collaborators */}
      <div className="p-6 md:p-8 rounded-[24px] bg-[#161412] border-2 border-white/20 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base md:text-lg font-black text-white font-clash m-0">Members & Collaborators</h2>
            <p className="text-xs text-white/40 mt-0.5 m-0">View, invite, and manage collaborators with access to this workspace</p>
          </div>
          <button
            type="button"
            onClick={() => {
              openDrawer('share-note', {
                resourceType: 'project',
                resourceId: activeWorkspace.id,
                resourceTitle: activeWorkspace.title,
                onShared: () => { void loadWorkspaceDetails(); },
              });
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-bold transition-all cursor-pointer border-2 border-[#6366F1] shadow-md"
          >
            <UserPlus size={13} />
            <span>Manage & Invite</span>
          </button>
        </div>

        <form onSubmit={handleAddMember} className="p-4 rounded-2xl bg-[#0A0908] border-2 border-white/15 space-y-4">
          <UserSearch
            label="SEARCH AND SELECT USERS TO INVITE"
            placeholder="Search by username, display name, or email..."
            selectedUsers={selectedUsers}
            onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
            onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
            multiple={true}
            excludeIds={[_user?.$id, ...collaborators.map(c => c.userId || c.entityId || c.$id)].filter(Boolean)}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-wider">Access Role:</span>
              <select
                value={permissionRole}
                onChange={(e: any) => setPermissionRole(e.target.value)}
                className="h-9 px-3 rounded-xl bg-[#161412] border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-[#6366F1]"
              >
                <option value="member">Editor / Member</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={addingMember || selectedUsers.length === 0}
              className="px-4 h-9 bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1.5 cursor-pointer border-2 border-[#6366F1] shadow-md shrink-0"
            >
              <UserPlus size={13} />
              <span>{addingMember ? 'Sending Invites...' : `Send ${selectedUsers.length > 1 ? `${selectedUsers.length} Invites` : 'Invite'}`}</span>
            </button>
          </div>
        </form>

        {/* Collaborators Subsections: Join Requests, Pending Invites, Active Members */}
        {(() => {
          const joinRequests = collaborators.filter((c) => c.status === 'requested');
          const pendingInvites = collaborators.filter((c) => c.status === 'pending');
          const activeMembers = collaborators.filter((c) => c.status === 'accepted' || (!c.status && c.accepted !== false));

          return (
            <div className="space-y-4">
              {/* 1. Inbound Join Requests */}
              {joinRequests.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-clash flex items-center gap-1.5">
                      <Clock size={12} />
                      Pending Join Requests ({joinRequests.length})
                    </span>
                    <span className="text-[10px] text-amber-400/60 font-mono">Requires Admin Approval</span>
                  </div>
                  <div className="space-y-2">
                    {joinRequests.map((c) => (
                      <div key={c.$id || c.userId} className="flex items-center justify-between p-3 rounded-xl bg-[#0A0908] border border-amber-500/20 hover:border-amber-500/40 transition-colors gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IdentityAvatar
                            fileId={c.avatar || c.profilePicId || null}
                            alt={c.displayName || c.username || c.userId}
                            fallback={(c.displayName || c.username || c.userId || '?').charAt(0).toUpperCase()}
                            size={34}
                            userId={c.userId || c.$id}
                            displayName={c.displayName}
                            username={c.username}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white font-mono truncate">{c.displayName || (c.username ? `@${c.username}` : c.userId)}</div>
                            <div className="text-[10px] text-amber-400/70 font-mono">Requested via invite link</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              openDrawer('project-join-request-confirm', {
                                action: 'grant',
                                requesterName: c.displayName || c.username || c.userId,
                                projectName: activeWorkspace.title,
                                onConfirm: async (role?: string) => {
                                  const validRole = (role === 'admin' || role === 'editor' || role === 'viewer') ? role : 'viewer';
                                  await ProjectsService.approveJoinRequest(activeWorkspace.id, c.userId, validRole);
                                  toast.success(`Access granted to ${c.displayName || c.username || c.userId}`);
                                  void loadWorkspaceDetails();
                                },
                              });
                            }}
                            className="px-2.5 py-1 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <UserCheck size={12} />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              openDrawer('project-join-request-confirm', {
                                action: 'deny',
                                requesterName: c.displayName || c.username || c.userId,
                                projectName: activeWorkspace.title,
                                onConfirm: async () => {
                                  await ProjectsService.removeCollaborator(activeWorkspace.id, c.userId);
                                  toast.success(`Request denied`);
                                  void loadWorkspaceDetails();
                                },
                              });
                            }}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="Deny Request"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Outbound Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-[#6366F1]/5 border border-[#6366F1]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#818CF8] font-clash flex items-center gap-1.5">
                      <Clock size={12} />
                      Pending Outbound Invites ({pendingInvites.length})
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">Awaiting User Acceptance</span>
                  </div>
                  <div className="space-y-2">
                    {pendingInvites.map((c) => (
                      <div key={c.$id || c.userId} className="flex items-center justify-between p-3 rounded-xl bg-[#0A0908] border border-white/15 hover:border-white/30 transition-colors gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IdentityAvatar
                            fileId={c.avatar || c.profilePicId || null}
                            alt={c.displayName || c.username || c.userId}
                            fallback={(c.displayName || c.username || c.userId || '?').charAt(0).toUpperCase()}
                            size={34}
                            userId={c.userId || c.$id}
                            displayName={c.displayName}
                            username={c.username}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white font-mono truncate">{c.displayName || (c.username ? `@${c.username}` : c.userId)}</div>
                            <div className="text-[10px] text-[#818CF8] uppercase font-mono font-bold">Role: {c.permissionLevel || c.permission || 'Member'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(c.userId)}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-xs font-medium"
                            title="Cancel Invite"
                          >
                            Cancel Invite
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Active Workspace Members */}
              <div className="space-y-2">
                {activeMembers.length === 0 && joinRequests.length === 0 && pendingInvites.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/40 rounded-xl bg-[#0A0908] border-2 border-white/15">
                    No additional collaborators registered. You are the sole workspace owner.
                  </div>
                ) : (
                  activeMembers.map((c) => (
                    <div key={c.$id || c.entityId || c.userId} className="flex items-center justify-between p-3 rounded-xl bg-[#0A0908] border-2 border-white/15 hover:border-white/30 transition-colors gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IdentityAvatar
                          fileId={c.avatar || c.profilePicId || null}
                          alt={c.displayName || c.username || c.userId || c.entityId}
                          fallback={(c.displayName || c.username || c.userId || c.entityId || '?').charAt(0).toUpperCase()}
                          size={34}
                          userId={c.userId || c.entityId || c.$id}
                          displayName={c.displayName}
                          username={c.username}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white font-mono truncate">{c.displayName || (c.username ? `@${c.username}` : (c.userId || c.entityId))}</div>
                          <div className="text-[10px] text-white/40 uppercase font-mono font-bold">{c.permissionLevel || c.role || c.permission || 'Member'}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            openDrawer('share-note', {
                              resourceType: 'project',
                              resourceId: activeWorkspace.id,
                              resourceTitle: activeWorkspace.title,
                              initialCollaborator: {
                                userId: c.userId || c.entityId,
                                username: c.username || c.userId || c.entityId,
                                displayName: c.displayName || c.userId || c.entityId,
                                avatar: c.avatar || null,
                                permissionLevel: c.permissionLevel || (c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer')),
                              },
                              onShared: () => { void loadWorkspaceDetails(); },
                            });
                          }}
                          className="p-1.5 text-xs text-[#818CF8] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer font-medium"
                          title="Edit Access Level"
                        >
                          Edit Access
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(c.userId || c.entityId)}
                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          title="Remove Member"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Workspace Keys */}
      <div className="p-6 md:p-8 rounded-[24px] bg-[#161412] border-2 border-white/20 shadow-xl space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base md:text-lg font-black text-white font-clash m-0">Workspace Keys</h2>
            <p className="text-xs text-white/40 mt-0.5 m-0">Personal Access Tokens scoped exclusively to this workspace</p>
          </div>
          <button
            type="button"
            onClick={() => setCreatePatOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-bold transition-all cursor-pointer border-2 border-[#6366F1] shadow-md"
          >
            <Plus size={13} />
            <span>Create Key</span>
          </button>
        </div>

        {loadingPats ? (
          <div className="py-6 flex justify-center text-white/40 text-xs">
            <RefreshCw size={16} className="animate-spin text-[#6366F1] mr-2" /> Loading keys...
          </div>
        ) : pats.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#0A0908] border-2 border-dashed border-white/15 text-center">
            <KeyRound className="h-6 w-6 text-white/20 mx-auto mb-2" />
            <p className="text-xs font-bold text-white/70 m-0">No workspace keys yet</p>
            <p className="text-xs text-white/40 mt-1 m-0">Create a key to interact with this workspace via the API</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pats.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0908] border-2 border-white/15 hover:border-white/30 transition-colors gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-white font-clash m-0 truncate">{p.name}</p>
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.2 rounded ${
                      p.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/10 text-white/40 border border-white/10'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#818CF8] mt-0.5 m-0 truncate">
                    kyl_pat_{p.tokenPrefix}_...
                  </p>
                </div>
                {p.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleRevokePat(p.id)}
                    className="shrink-0 p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Revoke key"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CreatePatDrawer
        open={createPatOpen}
        onClose={() => setCreatePatOpen(false)}
        onCreated={() => { if (activeWorkspace?.id) void loadWorkspacePats(activeWorkspace.id); }}
        isWorkspace={true}
        workspaceId={activeWorkspace?.id}
      />

      {/* Danger Zone */}
      <div className="p-6 md:p-8 rounded-[24px] bg-[#161412] border-2 border-red-500/40 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          <h2 className="text-base font-bold font-clash m-0">Danger Zone</h2>
        </div>
        <p className="text-xs text-white/60 m-0">Archive or permanently purge this workspace and detach objects.</p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleArchiveWorkspace}
            className="flex-1 h-10 border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Archive size={14} />
            <span>{status === 'active' ? 'Archive Workspace' : 'Restore Workspace'}</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteWorkspace}
            className="flex-1 h-10 border-2 border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Purge Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}
