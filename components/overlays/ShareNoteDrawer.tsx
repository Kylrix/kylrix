'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, ArrowLeft, Trash2, ChevronDown, ShieldCheck, Link, Copy, Check, Info } from 'lucide-react';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { grantPermissionSecure, getResourceCollaboratorsSecure, revokePermissionSecure, PermissionLevel } from '@/lib/actions/secure-ops';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { hasPaidKylrixPlan } from '@/lib/utils';
import toast from 'react-hot-toast';

// Unified config builder for dynamic resource terminology & branding
const getResourceConfig = (type: string) => {
  switch (type) {
    case 'task':
    case 'goal':
      return {
        labelSingular: 'Assignee',
        labelPlural: 'Assignees',
        brandColor: '#A855F7',
        allowedPermissions: ['viewer', 'editor', 'admin'],
        addOnlyViewer: false,
        permissionDetails: {
          viewer: { title: 'Observer', desc: 'Can read, track status, and monitor this goal.' },
          editor: { title: 'Assignee', desc: 'Can execute tasks, mark items complete, and modify details.' },
          admin: { title: 'Manager', desc: 'Full administrative rights to modify and assign this goal.' }
        }
      };
    case 'event':
      return {
        labelSingular: 'Organizer',
        labelPlural: 'Organizers',
        brandColor: '#F59E0B',
        allowedPermissions: ['viewer', 'editor', 'admin'],
        addOnlyViewer: false,
        permissionDetails: {
          viewer: { title: 'Attendee', desc: 'Can view event and register to attend.' },
          editor: { title: 'Organizer', desc: 'Can edit event details, manage schedule and attendees.' },
          admin: { title: 'Lead Organizer', desc: 'Full ownership and admin rights over the event.' }
        }
      };
    case 'huddle':
    case 'call':
      return {
        labelSingular: 'Co-host',
        labelPlural: 'Co-hosts',
        brandColor: '#EC4899',
        allowedPermissions: ['viewer', 'admin'], // Viewers elevated to Co-host (Admin)
        addOnlyViewer: true,
        permissionDetails: {
          viewer: { title: 'Participant', desc: 'Can view, listen and participate in the huddle.' },
          admin: { title: 'Co-host', desc: 'Full moderation rights, including upgrading other participants.' }
        }
      };
    case 'group':
      return {
        labelSingular: 'Member',
        labelPlural: 'Members',
        brandColor: '#3B82F6',
        allowedPermissions: ['viewer', 'admin'], // Viewers elevated to Admin
        addOnlyViewer: true,
        permissionDetails: {
          viewer: { title: 'Member', desc: 'Standard member access to channels, chats and calls.' },
          admin: { title: 'Admin', desc: 'Full administrative rights to moderate the group.' }
        }
      };
    case 'form':
      return {
        labelSingular: 'Collaborator',
        labelPlural: 'Collaborators',
        brandColor: '#10B981',
        allowedPermissions: ['viewer', 'editor', 'admin'],
        addOnlyViewer: false,
        permissionDetails: {
          viewer: { title: 'Viewer', desc: 'Can view form structure and list responses.' },
          editor: { title: 'Editor', desc: 'Can edit form fields, styling and settings.' },
          admin: { title: 'Admin', desc: 'Full admin access, including sharing and deletions.' }
        }
      };
    case 'project':
      return {
        labelSingular: 'Collaborator',
        labelPlural: 'Collaborators',
        brandColor: '#6366F1',
        allowedPermissions: ['viewer', 'editor', 'admin'],
        addOnlyViewer: false,
        permissionDetails: {
          viewer: { title: 'Viewer', desc: 'Can read and review project objects, boards, and chats.' },
          editor: { title: 'Editor', desc: 'Can add, modify, and shape project details and items.' },
          admin: { title: 'Admin', desc: 'Full administrator access to manage settings and collaborators.' }
        }
      };
    case 'note':
    default:
      return {
        labelSingular: 'Collaborator',
        labelPlural: 'Collaborators',
        brandColor: '#6366F1',
        allowedPermissions: ['viewer', 'editor', 'admin'],
        addOnlyViewer: false,
        permissionDetails: {
          viewer: { title: 'Viewer', desc: 'Can read and view note contents.' },
          editor: { title: 'Editor', desc: 'Can edit and write updates to the note.' },
          admin: { title: 'Admin', desc: 'Full admin access, including sharing permissions.' }
        }
      };
  }
};

export function ShareNoteDrawer({ isOpen, onClose, noteId, noteTitle, resourceType = 'note', resourceId }: { 
    isOpen: boolean;
    onClose: () => void;
    noteId?: string;
    noteTitle?: string;
    resourceType?: 'note' | 'project' | 'task' | 'goal' | 'event' | 'huddle' | 'call' | 'group' | string;
    resourceId?: string;
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { drawerData, open } = useUnifiedDrawer();
  const { user } = useAuth();
  
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('viewer');
  const [loading, setLoading] = useState(false);

  // Dynamic Invite Link parameters
  const [copiedLink, setCopiedLink] = useState(false);
  const [showInviteSection, setShowInviteSection] = useState(false);
  
  // Edit specific collaborator state
  const [editingCollaborator, setEditingCollaborator] = useState<any | null>(null);

  // Nested Permission Drawer state
  const [isPermissionDrawerOpen, setIsPermissionDrawerOpen] = useState(false);

  // Screen layout state
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resolve IDs and titles from polymorphic parent schemas
  const activeResourceId = noteId || resourceId || drawerData?.noteId || drawerData?.resourceId || '';
  const activeResourceTitle = noteTitle || drawerData?.noteTitle || drawerData?.resourceTitle || 'Kylrix Resource';
  const config = useMemo(() => getResourceConfig(resourceType), [resourceType]);

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (resourceType === 'project') return `${window.location.origin}/project/${activeResourceId}`;
    if (resourceType === 'note') return `${window.location.origin}/note/shared/${activeResourceId}`;
    return `${window.location.origin}/shared/${resourceType}/${activeResourceId}`;
  }, [resourceType, activeResourceId]);

  const fetchExistingCollaborators = useCallback(async () => {
    if (!activeResourceId) return;
    
    setIsLoadingExisting(true);
    try {
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: activeResourceId,
            resourceType: (resourceType === 'goal' ? 'task' : resourceType) as any,
            jwt
        });
        setCollaboratorProfiles(collaborators);
    } catch (err) {
        console.error('Failed to fetch existing collaborators:', err);
    } finally {
        setIsLoadingExisting(false);
    }
  }, [activeResourceId, resourceType]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (isOpen && activeResourceId) {
        fetchExistingCollaborators();

        if (drawerData?.initialCollaborator) {
            setEditingCollaborator(drawerData.initialCollaborator);
            setPermission(drawerData.initialCollaborator.permissionLevel || 'viewer');
        }
    }
    if (!isOpen) {
      setEditingCollaborator(null);
      setSelectedUsers([]);
      setPermission('viewer');
      setCopiedLink(false);
      setShowInviteSection(false);
    }
    return () => setIsDrawerOpen(false);
  }, [isOpen, activeResourceId, setIsDrawerOpen, fetchExistingCollaborators, drawerData?.initialCollaborator]);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast.success('Secure invite link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err: any) {
      toast.error('Failed to copy link: ' + err.message);
    }
  };

  const handleGrant = async () => {
    if (selectedUsers.length === 0 || !user?.$id) return;

    // Free plan collaborators count ceiling gating (strict limit of 8 total collaborators)
    const isPaid = hasPaidKylrixPlan(user);
    if (!isPaid && collaboratorProfiles.length + selectedUsers.length >= 8) {
      toast.error(`Limit reached: Free plans are limited to 8 collaborators per resource. Upgrade to PRO to add more!`);
      open('pro-upgrade', {});
      return;
    }

    setLoading(true);
    let successCount = 0;
    
    try {
        const { jwt } = await account.createJWT();
        for (const targetUser of selectedUsers) {
            await grantPermissionSecure({
                userId: user.$id,
                resourceId: activeResourceId,
                resourceType: (resourceType === 'goal' ? 'task' : resourceType) as any,
                resourceTitle: activeResourceTitle,
                targetUserId: targetUser.id,
                permission,
                actorName: user.name || 'A Kylrix User',
                jwt: jwt
            });
            
            if (drawerData?.onShared) {
                try {
                    await drawerData.onShared(targetUser.id, permission);
                } catch (err) {
                    console.error('onShared callback failed:', err);
                }
            }
            
            successCount++;
        }
        
        if (successCount === selectedUsers.length) {
            toast.success(`${config.labelSingular}(s) added successfully!`);
            fetchExistingCollaborators();
            setSelectedUsers([]);
            onClose();
        } else {
            toast.error(`Some ${config.labelPlural.toLowerCase()} could not be added.`);
        }
    } catch (err: any) {
        toast.error(err.message || `Failed to add ${config.labelSingular.toLowerCase()}`);
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateCollaborator = async () => {
      if (!editingCollaborator || !user?.$id) return;
      setLoading(true);
      try {
          const { jwt } = await account.createJWT();
          await grantPermissionSecure({
              userId: user.$id,
              resourceId: activeResourceId,
              resourceType: (resourceType === 'goal' ? 'task' : resourceType) as any,
              resourceTitle: activeResourceTitle,
              targetUserId: editingCollaborator.userId,
              permission: permission,
              actorName: user.name || 'A Kylrix User',
              jwt: jwt,
              skipEmail: true // SILENT updates
          });
          toast.success('Access level updated!');
          fetchExistingCollaborators();
          setEditingCollaborator(null);
      } catch (err: any) {
          toast.error(err.message || 'Failed to update access');
      } finally {
          setLoading(false);
      }
  };

  const handleRevokeCollaborator = async () => {
      if (!editingCollaborator || !user?.$id) return;
      
      onClose(); // Close main drawer to show confirmation Dialog beautifully
      open('delete-confirm', {
          title: `Remove ${config.labelSingular}?`,
          description: `Are you sure you want to remove ${editingCollaborator.displayName || editingCollaborator.username} from this workspace? They will instantly lose all access.`,
          resourceName: 'this access',
          confirmLabel: `Remove ${config.labelSingular}`,
          onConfirm: async () => {
              setLoading(true);
              try {
                  const { jwt } = await account.createJWT();
                  await revokePermissionSecure({
                      resourceId: activeResourceId,
                      resourceType: (resourceType === 'goal' ? 'task' : resourceType) as any,
                      targetUserId: editingCollaborator.userId,
                      jwt: jwt
                  });
                  toast.success(`${config.labelSingular} removed successfully!`);
                  fetchExistingCollaborators();
                  setEditingCollaborator(null);
              } catch (err: any) {
                  toast.error(err.message || `Failed to remove ${config.labelSingular.toLowerCase()}`);
              } finally {
                  setLoading(false);
              }
          }
      });
  };

  const renderContent = () => {
      if (editingCollaborator) {
          return (
            <div className="flex flex-col gap-6">
              {/* Collaborator Profile Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#0A0908] border border-[#1C1A18]">
                <IdentityAvatar
                  fileId={editingCollaborator.avatar}
                  alt={editingCollaborator.displayName}
                  fallback={(editingCollaborator.displayName || 'U').charAt(0).toUpperCase()}
                  size={48}
                  verified={editingCollaborator.verified}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-white truncate font-satoshi">
                    {editingCollaborator.displayName || editingCollaborator.username}
                  </p>
                  <p className="text-xs text-white/40 font-bold truncate font-satoshi mt-0.5">
                    @{editingCollaborator.username}
                  </p>
                </div>
              </div>

              {/* Permission Level Selector Trigger */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-white/30 tracking-wider uppercase block font-satoshi">
                  Access Permission Level
                </span>
                <button 
                  type="button"
                  onClick={() => setIsPermissionDrawerOpen(true)}
                  className="flex items-center justify-between bg-[#0A0908] p-4 rounded-2xl border border-[#1C1A18] hover:border-white/15 transition duration-200 w-full"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} style={{ color: config.brandColor }} />
                    <span className="font-extrabold text-sm text-white capitalize font-satoshi">
                      {(config.permissionDetails as any)?.[permission]?.title || permission}
                    </span>
                  </div>
                  <ChevronDown size={18} className="text-white/40" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleUpdateCollaborator}
                  disabled={loading}
                  style={{ backgroundColor: config.brandColor }}
                  className="w-full flex items-center justify-center rounded-xl font-extrabold text-xs text-black py-4 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed font-satoshi"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Save New Access'
                  )}
                </button>
                <button 
                  type="button"
                  onClick={handleRevokeCollaborator}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl font-extrabold text-xs text-[#FF453A] border border-[#1C1A18] hover:border-[#FF453A]/30 hover:bg-[#FF453A]/5 py-4 transition disabled:opacity-50 disabled:cursor-not-allowed font-satoshi"
                >
                  <Trash2 size={16} />
                  <span>Remove {config.labelSingular}</span>
                </button>
              </div>
            </div>
          );
      }

      return (
        <div className="flex flex-col gap-6">
          {/* 1. Existing Workspace Collaborators List */}
          {collaboratorProfiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-white/30 tracking-wider uppercase block font-satoshi">
                Workspace {config.labelPlural} ({collaboratorProfiles.length})
              </span>
              <div className="flex flex-col gap-2">
                {collaboratorProfiles.map((profile) => (
                  <button 
                    type="button"
                    key={profile.$id || profile.userId} 
                    onClick={() => {
                      setEditingCollaborator(profile);
                      setPermission(profile.permissionLevel || 'viewer');
                    }}
                    className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-[#0A0908] border border-[#1C1A18] hover:border-white/15 hover:bg-white/[0.01] transition duration-200 w-full text-left"
                  >
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                      <IdentityAvatar
                        fileId={profile.avatar || profile.profilePicId || null}
                        alt={profile.displayName || profile.username}
                        fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                        size={36}
                        verified={profile.tier === 'admin' || profile.verified}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="font-extrabold text-sm text-white truncate font-satoshi">
                        {profile.displayName || profile.username}
                      </span>
                      <span className="text-xs text-white/40 truncate font-bold font-satoshi">
                        @{profile.username}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <span 
                        style={{ color: config.brandColor, backgroundColor: `${config.brandColor}14` }}
                        className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider font-satoshi border border-current/10"
                      >
                        {(config.permissionDetails as any)?.[profile.permissionLevel?.toLowerCase() as PermissionLevel]?.title || profile.permissionLevel || 'Viewer'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Invite Search Input Field */}
          <div className="flex flex-col gap-1.5">
            <UserSearch 
              label={`INVITE NEW ${config.labelPlural.toUpperCase()}`}
              placeholder="Search by name or @username"
              selectedUsers={selectedUsers}
              onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
              onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
              multiple={true}
              excludeIds={[user?.$id, ...collaboratorProfiles.map(p => p.userId || p.$id)].filter(Boolean)}
            />
          </div>

          {/* 3. Default Access Rights for invitation */}
          {!config.addOnlyViewer && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-white/30 tracking-wider uppercase block font-satoshi">
                Set Access Rights
              </span>
              <button 
                type="button"
                onClick={() => setIsPermissionDrawerOpen(true)}
                className="flex items-center justify-between bg-[#0A0908] p-4 rounded-2xl border border-[#1C1A18] hover:border-white/15 transition duration-200 w-full"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} style={{ color: config.brandColor }} />
                  <span className="font-extrabold text-sm text-white capitalize font-satoshi">
                    {(config.permissionDetails as any)?.[permission]?.title || permission}
                  </span>
                </div>
                <ChevronDown size={18} className="text-white/40" />
              </button>
            </div>
          )}

          {/* 4. Send Invitation Button */}
          <button 
            type="button"
            onClick={handleGrant} 
            disabled={loading || selectedUsers.length === 0}
            style={{ backgroundColor: selectedUsers.length > 0 ? config.brandColor : undefined }}
            className={`w-full flex items-center justify-center rounded-xl font-extrabold text-xs text-black py-4 transition hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30 font-satoshi`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              'Send Invitation'
            )}
          </button>

          {/* 5. Collapsible Invite Link & Claim Code Section */}
          <div className="border border-[#1C1A18] rounded-2xl bg-[#0A0908] overflow-hidden">
            <button 
              type="button"
              onClick={() => setShowInviteSection(!showInviteSection)}
              className="p-4 w-full flex items-center justify-between hover:bg-white/[0.01] transition duration-200 select-none text-left"
            >
              <div className="flex items-center gap-3">
                <Link size={16} style={{ color: config.brandColor }} />
                <span className="font-extrabold text-sm text-white font-satoshi">
                  Invite Link
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className={`text-white/40 transition duration-200 ${showInviteSection ? 'rotate-180' : ''}`} 
              />
            </button>
            {showInviteSection && (
              <div className="p-4 pt-0 border-t border-white/[0.02] flex flex-col gap-4">
                <div className="mt-2">
                  <span className="text-[9px] font-black text-white/30 tracking-wider uppercase block mb-1.5 font-satoshi">
                    SECURE INVITE URL
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 bg-[#161412] border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-white/60 truncate select-all">
                      {inviteUrl}
                    </div>
                    <button 
                      type="button"
                      onClick={handleCopyLink} 
                      style={{ color: copiedLink ? '#10B981' : undefined }}
                      className="p-2.5 rounded-xl bg-[#161412] border border-white/5 hover:border-white/10 hover:bg-white/5 transition flex items-center justify-center text-white flex-shrink-0"
                    >
                      {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.01] border border-dashed border-white/10 mt-1">
                  <Info size={14} style={{ color: config.brandColor }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white/45 leading-relaxed font-satoshi">
                    Distribute this link. Anyone accessing this link will be added contextually as an active resource participant with the set default permissions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div 
        className={`fixed bg-[#161412] border-[#34322F] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          isDesktop 
            ? 'top-0 right-0 h-screen w-[480px] border-l rounded-l-none'
            : 'bottom-0 left-0 right-0 max-h-[90dvh] h-auto border-t rounded-t-[28px] max-w-[720px] mx-auto'
        }`}
      >
        {/* Mobile Drag Handle */}
        {!isDesktop && (
          <div 
            className="flex justify-center py-3 cursor-pointer select-none"
            onClick={onClose}
          >
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
          </div>
        )}

        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#1C1A18] shrink-0">
          <div className="flex items-center gap-3">
            {editingCollaborator && (
              <button 
                type="button"
                onClick={() => setEditingCollaborator(null)} 
                className="p-1 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h3 className="font-extrabold text-lg text-white font-clash tracking-tight">
              {editingCollaborator ? 'Manage Permission' : `Manage ${config.labelPlural}`}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body content scrollable container */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoadingExisting && !editingCollaborator ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>

      {/* Nested Permission Selection Bottom Drawer */}
      {isPermissionDrawerOpen && (
        <>
          {/* Nested Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 animate-in fade-in"
            onClick={() => setIsPermissionDrawerOpen(false)}
          />

          {/* Nested Drawer Container */}
          <div 
            className={`fixed bg-[#0A0908] border-[#34322F] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-[60] ${
              isDesktop 
                ? 'top-0 right-0 h-screen w-[480px] border-l rounded-l-none'
                : 'bottom-0 left-0 right-0 max-h-[80dvh] h-auto border-t rounded-t-[24px] max-w-[720px] mx-auto'
            }`}
          >
            {/* Mobile Drag Handle */}
            {!isDesktop && (
              <div 
                className="flex justify-center py-3 cursor-pointer select-none"
                onClick={() => setIsPermissionDrawerOpen(false)}
              >
                <div className="w-10 h-1 rounded bg-[#3D3A36]" />
              </div>
            )}

            <div className="p-6">
              <h3 className="font-extrabold text-lg text-white font-clash tracking-tight mb-4">
                Assign Access Level
              </h3>

              <div className="flex flex-col gap-3">
                {[
                  { value: 'viewer', title: (config.permissionDetails as any)?.viewer?.title || 'Viewer', desc: (config.permissionDetails as any)?.viewer?.desc || `Can read, download, and review the contents of this ${resourceType}.` },
                  { value: 'editor', title: (config.permissionDetails as any)?.editor?.title || 'Editor', desc: (config.permissionDetails as any)?.editor?.desc || `Can edit, write updates, comment, and fully shape ${resourceType} contents.` },
                  { value: 'admin', title: (config.permissionDetails as any)?.admin?.title || 'Admin', desc: (config.permissionDetails as any)?.admin?.desc || `Full ownership level rights, including the ability to manage other participants.` }
                ].filter(item => config.allowedPermissions.includes(item.value)).map((item) => {
                  const isSelected = permission === item.value;
                  const borderStyle = isSelected 
                    ? { borderColor: config.brandColor, backgroundColor: `${config.brandColor}14` }
                    : { borderColor: '#1C1A18', backgroundColor: '#161412' };
                  
                  return (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => {
                        setPermission(item.value as PermissionLevel);
                        setIsPermissionDrawerOpen(false);
                      }}
                      style={borderStyle}
                      className="p-4 rounded-2xl border text-left transition duration-200 hover:brightness-110 flex flex-col gap-1 w-full"
                    >
                      <span className="font-extrabold text-sm text-white font-satoshi">
                        {item.title}
                      </span>
                      <span className="text-xs text-white/40 leading-relaxed font-satoshi">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
