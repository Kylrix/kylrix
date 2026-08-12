'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderKanban, 
  Users, 
  UserPlus, 
  UserMinus, 
  Globe, 
  Lock, 
  Archive, 
  Trash2, 
  Save, 
  RefreshCw, 
  Mail,
  AlertTriangle,
  KeyRound,
  Plus,
  Code2
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { Projects } from '@/types/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { toast } from 'react-hot-toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { listPats, revokePat } from '@/lib/actions/client-ops';
import { CreatePatDrawer } from '@/components/settings/CreatePatDrawer';

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
  const [newMemberEmail, setNewMemberEmail] = useState('');
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
    try {
      const data = await ProjectsService.getProject(activeWorkspace.id);
      if (data) {
        setProject(data);
        setTitle(data.title || '');
        setSummary(data.summary || '');
        setVisibility(data.visibility === 'public' || data.isPublic ? 'public' : 'private');
        setStatus(data.status === 'archived' ? 'archived' : 'active');
      }

      // Load collaborators
      try {
        const res = await ProjectsService.listProjectCollaborators(activeWorkspace.id);
        setCollaborators(res?.rows || []);
      } catch {
        setCollaborators([]);
      }
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
    if (!activeWorkspace?.id || !newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      await ProjectsService.addCollaborator(activeWorkspace.id, newMemberEmail.trim(), 'member');
      toast.success('Member added / invited to workspace');
      setNewMemberEmail('');
      void loadWorkspaceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
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
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="p-12 text-center rounded-3xl bg-[#161412] border border-[#1C1A18]">
          <FolderKanban className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-black text-white mb-2 font-clash">Personal Workspace Selected</h3>
          <p className="text-sm text-[#9B9691] max-w-md mx-auto mb-6">
            You are currently in your default personal workspace. Switch to a custom workspace using the top header navigation to configure workspace-level settings, members, and access control.
          </p>
        </div>

        {/* Workspace Keys — disabled for personal workspace */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-[#1C1A18]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-white font-clash">Workspace Keys</h2>
              <p className="text-xs text-[#9B9691] mt-0.5">Tokens scoped exclusively to a workspace</p>
            </div>
            <KeyRound className="h-5 w-5 text-[#6366F1]/50" />
          </div>

          <div className="p-5 rounded-2xl bg-[#0A0908] border border-dashed border-white/10 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-[#6366F1]/60" />
            </div>
            <p className="text-sm font-bold text-white/70">Not available in Personal Workspace</p>
            <p className="text-xs text-[#9B9691] max-w-xs leading-relaxed">
              Workspace Keys can only be created for custom workspaces. For API access to your personal data, use a general Personal Access Token instead.
            </p>
            <button
              type="button"
              onClick={() => onGoToDevelopers?.()}
              className="mt-1 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-extrabold transition-colors"
            >
              <Code2 size={14} />
              Go to Settings &rsaquo; Developers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Overview & Metadata */}
      <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-[#1C1A18]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white font-clash">Workspace Settings</h2>
              {loading && <RefreshCw size={14} className="animate-spin text-[#6366F1]" />}
            </div>
            <p className="text-xs text-[#9B9691]">Manage details and visibility for &quot;{activeWorkspace.title}&quot;</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {status}
          </span>
        </div>

        <form onSubmit={handleSaveDetails} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#9B9691] uppercase tracking-wider">Workspace Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-white focus:outline-none focus:border-[#6366F1] text-sm"
              placeholder="Workspace Name"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#9B9691] uppercase tracking-wider">Description / Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full p-4 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-white focus:outline-none focus:border-[#6366F1] text-sm resize-none"
              placeholder="What is this workspace focused on?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#9B9691] uppercase tracking-wider">Visibility Mode</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  visibility === 'private'
                    ? 'bg-[#6366F1]/10 border-[#6366F1] text-white'
                    : 'bg-[#0A0908] border-[#1C1A18] text-white/60 hover:border-white/20'
                }`}
              >
                <Lock className="h-5 w-5 mt-0.5 text-[#6366F1]" />
                <div>
                  <div className="text-sm font-bold">Private</div>
                  <div className="text-xs text-[#9B9691]">Only invited collaborators can access</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  visibility === 'public'
                    ? 'bg-[#6366F1]/10 border-[#6366F1] text-white'
                    : 'bg-[#0A0908] border-[#1C1A18] text-white/60 hover:border-white/20'
                }`}
              >
                <Globe className="h-5 w-5 mt-0.5 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold">Public</div>
                  <div className="text-xs text-[#9B9691]">Accessible across ecosystem directory</div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 h-11 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Workspace Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Members & Collaborators */}
      <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-[#1C1A18]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-white font-clash">Members & Collaborators</h2>
            <p className="text-xs text-[#9B9691]">Manage people with access to this workspace</p>
          </div>
          <Users className="h-5 w-5 text-[#6366F1]" />
        </div>

        <form onSubmit={handleAddMember} className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Enter User ID or Email to invite..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#0A0908] border border-[#1C1A18] text-white text-xs focus:outline-none focus:border-[#6366F1]"
            />
          </div>
          <button
            type="submit"
            disabled={addingMember || !newMemberEmail.trim()}
            className="px-4 h-10 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            {addingMember ? 'Adding...' : 'Add Member'}
          </button>
        </form>

        <div className="space-y-2">
          {collaborators.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#9B9691] rounded-xl bg-[#0A0908] border border-[#1C1A18]">
              No additional collaborators registered. You are the sole workspace owner.
            </div>
          ) : (
            collaborators.map((c) => (
              <div key={c.$id || c.entityId || c.userId} className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0908] border border-[#1C1A18]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#6366F1]/20 text-[#6366F1] flex items-center justify-center text-xs font-bold">
                    {(c.userId || c.entityId || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{c.userId || c.entityId}</div>
                    <div className="text-[10px] text-[#9B9691] capitalize">{c.role || 'Member'}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveMember(c.userId || c.entityId)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remove Member"
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workspace Keys */}
      <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-[#1C1A18]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-white font-clash">Workspace Keys</h2>
            <p className="text-xs text-[#9B9691] mt-0.5">Personal Access Tokens scoped exclusively to this workspace</p>
          </div>
          <button
            type="button"
            onClick={() => setCreatePatOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-extrabold transition-colors"
          >
            <Plus size={14} />
            Create Key
          </button>
        </div>

        {loadingPats ? (
          <div className="py-8 flex justify-center">
            <RefreshCw size={20} className="animate-spin text-[#6366F1]" />
          </div>
        ) : pats.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#0A0908] border border-dashed border-white/10 text-center">
            <KeyRound className="h-6 w-6 text-white/20 mx-auto mb-2" />
            <p className="text-sm font-bold text-white/50">No workspace keys yet</p>
            <p className="text-xs text-[#9B9691] mt-1">Create a key to interact with this workspace via the API</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pats.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#0A0908] border border-[#1C1A18] gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      p.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/10 text-white/40 border border-white/10'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-white/40 mt-0.5 truncate">
                    kyl_pat_{p.tokenPrefix}_...
                  </p>
                </div>
                {p.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleRevokePat(p.id)}
                    className="shrink-0 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 size={15} />
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
      <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-red-500/20">
        <div className="flex items-center gap-2 text-red-500 mb-2">
          <AlertTriangle size={18} />
          <h2 className="text-lg font-black font-clash">Danger Zone</h2>
        </div>
        <p className="text-xs text-[#9B9691] mb-6">Archive or permanently purge this workspace.</p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={handleArchiveWorkspace}
            className="flex-1 px-4 py-3 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-2"
          >
            <Archive size={16} />
            {status === 'active' ? 'Archive Workspace' : 'Restore Workspace'}
          </button>

          <button
            type="button"
            onClick={handleDeleteWorkspace}
            className="flex-1 px-4 py-3 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Purge Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
