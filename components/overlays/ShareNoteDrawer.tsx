'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Button, Stack, alpha, CircularProgress } from '@mui/material';
import { X, ArrowLeft, Trash2, ChevronDown, ShieldCheck, UserPlus, Settings2 } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { grantPermissionSecure, getResourceCollaboratorsSecure, revokePermissionSecure, PermissionLevel } from '@/lib/actions/secure-ops';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import toast from 'react-hot-toast';

const DRAWER_SX = {
  borderTopLeftRadius: '28px',
  borderTopRightRadius: '28px',
  bgcolor: '#161412', // Deep Ash
  borderTop: '1px solid #1C1A18', // Rim/Border Ash
  maxWidth: 720,
  width: '100%',
  mx: 'auto',
  backgroundImage: 'none',
  color: '#fff',
};

export function ShareNoteDrawer({ isOpen, onClose, noteId, noteTitle, resourceType = 'note' }: { 
    isOpen: boolean;
    onClose: () => void;
    noteId: string;
    noteTitle: string;
    resourceType?: 'note' | 'project';
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { drawerData, open } = useUnifiedDrawer();
  const { user } = useAuth();
  
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('viewer');
  const [loading, setLoading] = useState(false);
  
  // Edit specific collaborator state
  const [editingCollaborator, setEditingCollaborator] = useState<any | null>(null);

  // Nested Permission Drawer state
  const [isPermissionDrawerOpen, setIsPermissionDrawerOpen] = useState(false);

  const fetchExistingCollaborators = React.useCallback(async () => {
    if (!noteId) return;
    
    setIsLoadingExisting(true);
    try {
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: noteId,
            resourceType: resourceType as any,
            jwt
        });
        setCollaboratorProfiles(collaborators);
    } catch (err) {
        console.error('Failed to fetch existing collaborators:', err);
    } finally {
        setIsLoadingExisting(false);
    }
  }, [noteId, resourceType]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (isOpen && noteId) {
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
    }
  }, [isOpen, noteId, setIsDrawerOpen, fetchExistingCollaborators, drawerData?.initialCollaborator]);

  const handleGrant = async () => {
    if (selectedUsers.length === 0 || !user?.$id) return;
    setLoading(true);
    let successCount = 0;
    
    try {
        const { jwt } = await account.createJWT();
        for (const targetUser of selectedUsers) {
            await grantPermissionSecure({
                userId: user.$id,
                resourceId: noteId,
                resourceType: resourceType as any,
                resourceTitle: noteTitle,
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
            toast.success('Collaborator(s) added successfully!');
            fetchExistingCollaborators();
            setSelectedUsers([]);
            onClose();
        } else {
            toast.error('Some collaborators could not be added.');
        }
    } catch (err: any) {
        toast.error(err.message || 'Failed to add collaborator');
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
              resourceId: noteId,
              resourceType: resourceType as any,
              resourceTitle: noteTitle,
              targetUserId: editingCollaborator.userId,
              permission: permission,
              actorName: user.name || 'A Kylrix User',
              jwt: jwt,
              skipEmail: true
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
          title: `Remove Collaborator?`,
          description: `Are you sure you want to remove ${editingCollaborator.displayName || editingCollaborator.username} from this workspace? They will instantly lose all access.`,
          resourceName: 'this access',
          confirmLabel: 'Remove Collaborator',
          onConfirm: async () => {
              setLoading(true);
              try {
                  const { jwt } = await account.createJWT();
                  await revokePermissionSecure({
                      resourceId: noteId,
                      resourceType: resourceType as any,
                      targetUserId: editingCollaborator.userId,
                      jwt: jwt
                  });
                  toast.success('Collaborator removed successfully!');
                  fetchExistingCollaborators();
                  setEditingCollaborator(null);
              } catch (err: any) {
                  toast.error(err.message || 'Failed to remove collaborator');
              } finally {
                  setLoading(false);
              }
          }
      });
  };

  const renderContent = () => {
      if (editingCollaborator) {
          return (
            <Stack spacing={4}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2.5, borderRadius: '20px', bgcolor: '#0A0908', border: '1px solid #1C1A18' }}>
                    <IdentityAvatar
                        fileId={editingCollaborator.avatar}
                        alt={editingCollaborator.displayName}
                        fallback={(editingCollaborator.displayName || 'U').charAt(0).toUpperCase()}
                        size={48}
                        verified={editingCollaborator.verified}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap variant="body1" sx={{ fontWeight: 900, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                          {editingCollaborator.displayName || editingCollaborator.username}
                        </Typography>
                        <Typography noWrap variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', fontFamily: 'var(--font-satoshi)' }}>
                          @{editingCollaborator.username}
                        </Typography>
                    </Box>
                </Stack>

                <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                        Access Permission Level
                    </Typography>
                    <Box 
                      onClick={() => setIsPermissionDrawerOpen(true)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: '#0A0908', // Inset Ash/Pitch Black
                        p: 2,
                        borderRadius: '16px',
                        border: '1px solid #1C1A18',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.15)' }
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <ShieldCheck size={18} style={{ color: '#6366F1' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)', color: 'white', textTransform: 'capitalize' }}>
                          {permission}
                        </Typography>
                      </Stack>
                      <ChevronDown size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </Box>
                </Box>

                <Stack spacing={2} sx={{ pt: 4 }}>
                    <Button 
                        variant="contained" 
                        fullWidth
                        onClick={handleUpdateCollaborator}
                        disabled={loading}
                        sx={{ borderRadius: '14px', fontWeight: 900, fontFamily: 'var(--font-satoshi)', py: 1.75, bgcolor: '#6366F1', color: '#000', textTransform: 'none', '&:hover': { bgcolor: alpha('#6366F1', 0.9) } }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Save New Access'}
                    </Button>
                    <Button 
                        variant="outlined" 
                        fullWidth
                        color="error"
                        onClick={handleRevokeCollaborator}
                        disabled={loading}
                        startIcon={<Trash2 size={16} />}
                        sx={{ borderRadius: '14px', fontWeight: 800, fontFamily: 'var(--font-satoshi)', py: 1.75, borderColor: '#1C1A18', color: '#FF453A', textTransform: 'none', '&:hover': { borderColor: '#FF453A', bgcolor: alpha('#FF453A', 0.05) } }}
                    >
                        Remove Collaborator
                    </Button>
                </Stack>
            </Stack>
          );
      }

      return (
        <Stack spacing={4}>
            {collaboratorProfiles.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                        Workspace Members ({collaboratorProfiles.length})
                    </Typography>
                    <Stack spacing={1.5}>
                        {collaboratorProfiles.map((profile) => (
                            <Box 
                                key={profile.$id || profile.userId} 
                                onClick={() => {
                                    setEditingCollaborator(profile);
                                    setPermission(profile.permissionLevel || 'viewer');
                                }}
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 2, 
                                    p: 1.75, 
                                    borderRadius: '16px', 
                                    bgcolor: '#0A0908', // Inset Ash/Pitch Black
                                    border: '1px solid #1C1A18',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        borderColor: 'rgba(255,255,255,0.15)',
                                        bgcolor: 'rgba(255,255,255,0.01)'
                                    }
                                }}
                            >
                                <IdentityAvatar
                                    fileId={profile.avatar || profile.profilePicId || null}
                                    alt={profile.displayName || profile.username}
                                    fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                    size={36}
                                    verified={profile.tier === 'admin' || profile.verified}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                            {profile.displayName || profile.username}
                                        </Typography>
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                px: 1.25, 
                                                py: 0.5, 
                                                borderRadius: '8px', 
                                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                color: '#6366F1',
                                                fontWeight: 900,
                                                fontSize: '9px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                fontFamily: 'var(--font-satoshi)'
                                            }}
                                        >
                                            {profile.permissionLevel || 'Viewer'}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                                        @{profile.username}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}

            <Box>
                <UserSearch 
                    label="INVITE NEW COLLABORATOR"
                    placeholder="Search by name or @username"
                    selectedUsers={selectedUsers}
                    onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
                    onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
                    multiple={true}
                    excludeIds={[user?.$id, ...collaboratorProfiles.map(p => p.userId || p.$id)].filter(Boolean)}
                />
            </Box>

            <Box>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                    Set Access Rights
                </Typography>
                <Box 
                  onClick={() => setIsPermissionDrawerOpen(true)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: '#0A0908', // Inset Ash/Pitch Black
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid #1C1A18',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.15)' }
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <ShieldCheck size={18} style={{ color: '#6366F1' }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)', color: 'white', textTransform: 'capitalize' }}>
                      {permission}
                    </Typography>
                  </Stack>
                  <ChevronDown size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </Box>
            </Box>

            <Button 
                variant="contained" 
                onClick={handleGrant} 
                disabled={loading || selectedUsers.length === 0}
                sx={{ borderRadius: '14px', fontWeight: 900, fontFamily: 'var(--font-satoshi)', py: 1.75, bgcolor: '#6366F1', color: '#000', textTransform: 'none', '&:hover': { bgcolor: alpha('#6366F1', 0.9) } }}
            >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Send Collaboration Invite'}
            </Button>
        </Stack>
      );
  };

  return (
    <>
      <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: DRAWER_SX }} ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}>
        <Box sx={{ p: 2.75, pb: 'calc(2.75rem + env(safe-area-inset-bottom))' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {editingCollaborator && (
                    <IconButton size="small" onClick={() => setEditingCollaborator(null)} sx={{ color: 'rgba(255,255,255,0.5)', ml: -1 }}>
                        <ArrowLeft size={20} />
                    </IconButton>
                )}
                <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                  {editingCollaborator ? 'Manage Permission' : (resourceType === 'project' ? 'Invite Collaborator' : 'Share Note')}
                </Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
          </Box>

          {isLoadingExisting && !editingCollaborator ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress color="primary" />
              </Box>
          ) : renderContent()}
        </Box>
      </Drawer>

      {/* Nested Permission Selection Bottom Drawer */}
      <Drawer
        anchor="bottom"
        open={isPermissionDrawerOpen}
        onClose={() => setIsPermissionDrawerOpen(false)}
        keepMounted={false}
        disablePortal={true}
        PaperProps={{
          sx: {
            bgcolor: '#0A0908', // Pitch Black for beautiful nested contrast!
            borderTop: '1px solid #1C1A18',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            p: 3,
            maxWidth: 720,
            width: '100%',
            mx: 'auto',
            backgroundImage: 'none',
            color: '#fff'
          }
        }}
      >
        <Box sx={{ width: 40, height: 4, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '2px', mx: 'auto', mb: 3 }} />
        
        <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2, letterSpacing: '-0.01em' }}>
          Assign Access Level
        </Typography>

        <Stack spacing={1.5}>
          {[
            { value: 'viewer', title: 'Viewer', desc: 'Can read, download, and review the contents of this workspace.' },
            { value: 'editor', title: 'Editor', desc: 'Can edit, write updates, comment, and fully shape workspace contents.' },
            { value: 'admin', title: 'Admin', desc: 'Full ownership level rights, including the ability to manage other collaborators.' }
          ].map((item) => (
            <Box
              key={item.value}
              onClick={() => {
                setPermission(item.value as PermissionLevel);
                setIsPermissionDrawerOpen(false);
              }}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: permission === item.value ? 'rgba(99, 102, 241, 0.08)' : '#161412',
                border: '1px solid',
                borderColor: permission === item.value ? '#6366F1' : '#1C1A18',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: permission === item.value ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)' }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 900, fontFamily: 'var(--font-satoshi)', color: 'white', mb: 0.5 }}>
                {item.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)', display: 'block', lineHeight: 1.4 }}>
                {item.desc}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}
