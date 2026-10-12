'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  Shield,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import {
  listMyTeamsSecure,
  createNativeTeamSecure,
  deleteNativeTeamSecure,
  getTeamMembershipsSecure,
  addTeamMemberSecure,
  removeTeamMemberSecure
} from '@/lib/actions/teams';
import { BillingDrawer } from '@/components/overlays/BillingDrawer';
import toast from 'react-hot-toast';

interface TeamItem {
  $id: string;
  name: string;
  total: number;
  $createdAt: string;
}

interface TeamMember {
  $id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roles: string[];
  joined: string | boolean;
  confirm: boolean;
}

export function TeamsTab() {
  const { currentTier } = useSubscription();
  const isTeamsTier = currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME' || isSelfHostedDeployment();

  const [billingDrawerOpen, setBillingDrawerOpen] = useState(false);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Selected team for member inspection
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, TeamMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({});

  // Add member form state
  const [addingMemberTeamId, setAddingMemberTeamId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!isTeamsTier) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listMyTeamsSecure();
      if (res.success && res.teams) {
        setTeams(res.teams as any);
      }
    } catch (err: any) {
      console.error('[TeamsTab] Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, [isTeamsTier]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const loadMembers = async (teamId: string) => {
    setLoadingMembers((prev) => ({ ...prev, [teamId]: true }));
    try {
      const res = await getTeamMembershipsSecure(teamId);
      if (res.success && res.memberships) {
        setMembers((prev) => ({ ...prev, [teamId]: res.memberships as any }));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load team members');
    } finally {
      setLoadingMembers((prev) => ({ ...prev, [teamId]: false }));
    }
  };

  const toggleExpandTeam = (teamId: string) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
    } else {
      setExpandedTeamId(teamId);
      if (!members[teamId]) {
        loadMembers(teamId);
      }
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const res = await createNativeTeamSecure(newTeamName.trim());
      if (res.success) {
        toast.success(`Team "${newTeamName.trim()}" created successfully`);
        setNewTeamName('');
        setShowCreateModal(false);
        fetchTeams();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await deleteNativeTeamSecure(teamId);
      if (res.success) {
        toast.success(`Team "${teamName}" deleted`);
        fetchTeams();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete team');
    }
  };

  const handleAddMember = async (e: React.FormEvent, teamId: string) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSubmittingInvite(true);
    try {
      const res = await addTeamMemberSecure({
        teamId,
        email: inviteEmail.trim(),
        roles: [inviteRole],
      });
      if (res.success) {
        toast.success(`Invitation sent to ${inviteEmail.trim()}`);
        setInviteEmail('');
        setAddingMemberTeamId(null);
        loadMembers(teamId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add member');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleRemoveMember = async (teamId: string, membershipId: string, name: string) => {
    if (!window.confirm(`Remove ${name || 'this member'} from the team?`)) {
      return;
    }

    try {
      const res = await removeTeamMemberSecure(teamId, membershipId);
      if (res.success) {
        toast.success('Member removed');
        loadMembers(teamId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove member');
    }
  };

  if (!isTeamsTier) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black font-clash text-white tracking-tight flex items-center gap-2">
            <Users className="text-[#6366F1]" size={22} />
            <span>Teams</span>
          </h2>
          <p className="text-xs text-white/40 font-semibold mt-1">
            Govern organization-level collaboration, workspaces, and system permissions across your company using organization teams.
          </p>
        </div>

        {/* Upgrade Banner for Non-Teams Tier */}
        <div className="bg-[#000000] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#6366F1]/10 rounded-full pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#818CF8] text-[10px] font-mono font-bold uppercase tracking-wider">
                <Lock size={12} />
                <span>Teams Plan Exclusive</span>
              </div>

              <h3 className="text-lg font-black text-white font-clash tracking-tight">
                Native Teams Governance is locked
              </h3>

              <p className="text-xs text-white/60 leading-relaxed font-medium">
                Teams exist to govern collaboration across workspaces and organizational domains. Organization Teams functionality is strictly reserved for the <span className="text-white font-bold">Teams Plan</span>. Note that object-level collaborator sharing remains completely free and available across all plans!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                  <span>Create and manage organization teams</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                  <span>Invite members with specific organizational roles</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                  <span>Centralized access control across workspaces</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                  <span>Unlimited object-level collaborators on all tiers</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setBillingDrawerOpen(true)}
                className="w-full md:w-auto h-12 px-6 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.35)] border-2 border-[#6366F1]"
              >
                <Sparkles size={16} />
                <span>Upgrade to Teams Plan</span>
              </button>
              <span className="text-[10px] text-white/40 font-mono">Current Plan: {currentTier}</span>
            </div>
          </div>
        </div>

        {billingDrawerOpen && (
          <BillingDrawer isOpen={billingDrawerOpen} onClose={() => setBillingDrawerOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black font-clash text-white tracking-tight flex items-center gap-2">
            <Users className="text-[#6366F1]" size={22} />
            <span>Teams</span>
          </h2>
          <p className="text-xs text-white/40 font-semibold mt-1">
            Manage your organization teams, govern organizational access, and invite team members.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="h-10 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0 border-2 border-[#6366F1]"
        >
          <Plus size={16} />
          <span>Create Team</span>
        </button>
      </div>

      {/* Create Team Modal / Inline Card */}
      {showCreateModal && (
        <form onSubmit={handleCreateTeam} className="p-5 bg-[#000000] border-2 border-[#6366F1]/50 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-black text-white font-clash">Create New Team</h3>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Team Name (e.g., Engineering, Marketing)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="flex-1 w-full bg-[#161412] border-2 border-white/20 focus:border-[#6366F1] rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-colors"
              autoFocus
            />
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newTeamName.trim()}
                className="h-9 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>{creating ? 'Creating...' : 'Create'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Teams List */}
      {loading ? (
        <div className="p-12 text-center text-white/40 text-xs font-mono flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-[#6366F1]" />
          <span>Loading teams...</span>
        </div>
      ) : teams.length === 0 ? (
        <div className="p-12 bg-[#000000] border-2 border-white/20 rounded-[28px] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/10 border-2 border-[#6366F1]/30 text-[#6366F1] flex items-center justify-center mx-auto">
            <Users size={24} />
          </div>
          <h3 className="text-white font-extrabold text-sm font-clash">No teams yet</h3>
          <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
            Create your first team to organize members and manage team-based workspace permissions.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-9 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md border-2 border-[#6366F1]"
          >
            <Plus size={14} />
            <span>Create Team</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const isExpanded = expandedTeamId === team.$id;
            const teamMembers = members[team.$id] || [];
            const isLoadingM = loadingMembers[team.$id];

            return (
              <div
                key={team.$id}
                className="bg-[#000000] border-2 border-white/20 hover:border-white/30 rounded-2xl p-5 shadow-xl transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 border-2 border-[#6366F1]/30 text-[#6366F1] flex items-center justify-center shrink-0">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-black text-base truncate font-clash">{team.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 shrink-0">
                          {team.total || teamMembers.length || 0} {team.total === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/40 mt-0.5 font-mono">
                        <span className="truncate">ID: {team.$id}</span>
                        <span>•</span>
                        <span>Created {new Date(team.$createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleExpandTeam(team.$id)}
                      className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 border border-white/10 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{isExpanded ? 'Hide Members' : 'Manage Members'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(team.$id, team.name)}
                      className="h-9 w-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/20 transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Expanded Team Members Area */}
                {isExpanded && (
                  <div className="pt-4 border-t border-white/10 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-xs font-black text-white/80 uppercase tracking-wider font-mono">
                        Team Members
                      </h4>
                      <button
                        type="button"
                        onClick={() => setAddingMemberTeamId(addingMemberTeamId === team.$id ? null : team.$id)}
                        className="text-xs text-[#818CF8] hover:text-[#A5B4FC] font-bold flex items-center gap-1 transition-colors"
                      >
                        <UserPlus size={14} />
                        <span>Add Member</span>
                      </button>
                    </div>

                    {/* Add Member Form */}
                    {addingMemberTeamId === team.$id && (
                      <form
                        onSubmit={(e) => handleAddMember(e, team.$id)}
                        className="p-4 rounded-xl bg-[#161412] border-2 border-white/15 space-y-3"
                      >
                        <div className="text-xs font-bold text-white">Invite / Add Member</div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                          <input
                            type="email"
                            placeholder="User Email Address"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="bg-[#000000] border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#6366F1]"
                            required
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-[#000000] border border-white/20 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#6366F1]"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                          <button
                            type="submit"
                            disabled={submittingInvite}
                            className="h-9 px-4 bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
                          >
                            {submittingInvite ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                            <span>Send</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Members List */}
                    {isLoadingM ? (
                      <div className="p-4 text-center text-white/40 text-xs font-mono flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-[#6366F1]" />
                        <span>Loading team members...</span>
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <div className="p-4 text-center text-white/40 text-xs font-mono">
                        No members found in this team.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.$id}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#161412] border border-white/10 text-xs gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/70 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">
                                {(member.userName || member.userEmail || 'U').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-bold truncate">
                                  {member.userName || member.userEmail || member.userId}
                                </div>
                                <div className="text-[10px] text-white/40 font-mono truncate">
                                  {member.userEmail || member.userId}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex gap-1">
                                {member.roles.map((role) => (
                                  <span
                                    key={role}
                                    className="px-2 py-0.5 rounded bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20 text-[9px] font-mono font-bold uppercase"
                                  >
                                    {role}
                                  </span>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(
                                    team.$id,
                                    member.$id,
                                    member.userName || member.userEmail
                                  )
                                }
                                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 flex items-center justify-center transition-colors"
                                title="Remove Member"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
