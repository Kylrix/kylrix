'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderKanban, 
  Users, 
  UserPlus, 
  UserMinus, 
  Shield, 
  Globe, 
  Lock, 
  Archive, 
  Trash2, 
  Save, 
  RefreshCw, 
  Check, 
  X,
  Mail,
  AlertTriangle
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { Projects } from '@/types/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { toast } from 'react-hot-toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export function WorkspaceTab() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const { open: openDrawer } = useUnifiedDrawer();

  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const [project, setProject] = useState<Projects | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  // Collaborators / Members
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

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
      title: `Purge Workspace "${activeWorkspace.name}"?`,
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
      <div className="p-12 text-center rounded-3xl bg-[#161412] border border-[#1C1A18] max-w-2xl mx-auto">
        <FolderKanban className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-black text-white mb-2 font-clash">Personal Workspace Selected</h3>
        <p className="text-sm text-[#9B9691] max-w-md mx-auto mb-6">
          You are currently in your default personal workspace. Switch to a custom workspace using the top header navigation to configure workspace-level settings, members, and access control.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Overview & Metadata */}
      <div className="p-6 md:p-8 rounded-3xl bg-[#161412] border border-[#1C1A18]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-white font-clash">Workspace Settings</h2>
            <p className="text-xs text-[#9B9691]">Manage details and visibility for &quot;{activeWorkspace.name}&quot;</p>
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
