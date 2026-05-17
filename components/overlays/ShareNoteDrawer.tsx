'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Button, Stack, Select, MenuItem, FormControl, alpha, CircularProgress } from '@mui/material';
import { X, ArrowLeft, Trash2, ShieldCheck } from 'lucide-react';
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
  borderTopLeftRadius: '26px',
  borderTopRightRadius: '26px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'
};

export function ShareNoteDrawer({ isOpen, onClose, noteId, noteTitle }: { 
    isOpen: boolean;
    onClose: () => void;
    noteId: string;
    noteTitle: string;
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { drawerData } = useUnifiedDrawer();
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('view');
  const [loading, setLoading] = useState(false);
  
  // Edit specific collaborator state
  const [editingCollaborator, setEditingCollaborator] = useState<any | null>(null);

  const fetchExistingCollaborators = React.useCallback(async () => {
    if (!noteId) return;
    
    // Defer slightly for smooth animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsLoadingExisting(true);
    try {
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: noteId,
            resourceType: 'note',
            jwt
        });
        setCollaboratorProfiles(collaborators);
    } catch (err) {
        console.error('Failed to fetch existing collaborators:', err);
    } finally {
        setIsLoadingExisting(false);
    }
  }, [noteId]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (isOpen && noteId) {
        fetchExistingCollaborators();

        // Handle direct entry into Edit Mode from external triggers (e.g. Note Detail)
        if (drawerData?.initialCollaborator) {
            setEditingCollaborator(drawerData.initialCollaborator);
            setPermission(drawerData.initialCollaborator.permissionLevel || 'view');
        }
    }
    if (!isOpen) {
        setEditingCollaborator(null);
        setSelectedUsers([]);
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
                resourceType: 'note',
                resourceTitle: noteTitle,
                targetUserId: targetUser.id,
                permission,
                actorName: user.name || 'A Kylrix User',
                jwt: jwt
            });
            successCount++;
        }
        
        if (successCount === selectedUsers.length) {
            toast.success('Collaborator(s) added!');
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
              resourceType: 'note',
              resourceTitle: noteTitle,
              targetUserId: editingCollaborator.userId,
              permission: permission,
              actorName: user.name || 'A Kylrix User',
              jwt: jwt,
              skipEmail: true // SILENT update
          });
          toast.success('Access updated');
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
      if (!window.confirm(`Are you sure you want to remove ${editingCollaborator.displayName || editingCollaborator.username}?`)) return;
      
      setLoading(true);
      try {
          const { jwt } = await account.createJWT();
          await revokePermissionSecure({
              resourceId: noteId,
              resourceType: 'note',
              targetUserId: editingCollaborator.userId,
              jwt: jwt
          });
          toast.success('Collaborator removed');
          fetchExistingCollaborators();
          setEditingCollaborator(null);
      } catch (err: any) {
          toast.error(err.message || 'Failed to remove collaborator');
      } finally {
          setLoading(false);
      }
  };

  const renderContent = () => {
      if (editingCollaborator) {
          return (
            <Stack spacing={4}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <IdentityAvatar
                        fileId={editingCollaborator.avatar}
                        alt={editingCollaborator.displayName}
                        fallback={(editingCollaborator.displayName || 'U').charAt(0).toUpperCase()}
                        size={48}
                        verified={editingCollaborator.verified}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'white', noWrap: true }}>{editingCollaborator.displayName || editingCollaborator.username}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', noWrap: true }}>@{editingCollaborator.username}</Typography>
                    </Box>
                </Stack>

                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 900, color: 'primary.main', mb: 1.5, display: 'block', letterSpacing: '0.1em' }}>
                        CHANGE ACCESS LEVEL
                    </Typography>
                    <FormControl fullWidth>
                        <Select 
                            value={permission} 
                            onChange={(e) => setPermission(e.target.value as PermissionLevel)}
                            sx={{
                                bgcolor: '#0A0908',
                                color: 'white',
                                borderRadius: '12px',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                            }}
                        >
                            <MenuItem value="view">Viewer</MenuItem>
                            <MenuItem value="edit">Editor</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Stack spacing={2}>
                    <Button 
                        variant="contained" 
                        fullWidth
                        onClick={handleUpdateCollaborator}
                        disabled={loading}
                        sx={{ borderRadius: '14px', fontWeight: 800, py: 1.75, bgcolor: '#6366F1' }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Update Access'}
                    </Button>
                    <Button 
                        variant="outlined" 
                        fullWidth
                        color="error"
                        onClick={handleRevokeCollaborator}
                        disabled={loading}
                        startIcon={<Trash2 size={18} />}
                        sx={{ borderRadius: '14px', fontWeight: 700, py: 1.5, borderColor: alpha('#ef4444', 0.3), '&:hover': { bgcolor: alpha('#ef4444', 0.05) } }}
                    >
                        Remove Collaborator
                    </Button>
                </Stack>
            </Stack>
          );
      }

      return (
        <Stack spacing={3}>
            {collaboratorProfiles.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5, display: 'block' }}>
                        EXISTING COLLABORATORS
                    </Typography>
                    <Stack spacing={1}>
                        {collaboratorProfiles.map((profile) => (
                            <Box 
                                key={profile.$id || profile.userId} 
                                onClick={() => {
                                    setEditingCollaborator(profile);
                                    setPermission(profile.permissionLevel || 'view');
                                }}
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1.5, 
                                    p: 1.25, 
                                    borderRadius: '12px', 
                                    bgcolor: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.05)',
                                        borderColor: 'rgba(255,255,255,0.1)'
                                    }
                                }}
                            >
                                <IdentityAvatar
                                    fileId={profile.avatar || profile.profilePicId || null}
                                    alt={profile.displayName || profile.username}
                                    fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                    size={28}
                                    verified={profile.tier === 'admin' || profile.verified}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'white' }}>
                                            {profile.displayName || profile.username}
                                        </Typography>
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                px: 1, 
                                                py: 0.25, 
                                                borderRadius: '6px', 
                                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                color: '#6366F1',
                                                fontWeight: 800,
                                                fontSize: '9px',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            {profile.permissionLevel || 'Viewer'}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
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
                    label="INVITE NEW COLLABORATOR(S)"
                    placeholder="Search by name or @username"
                    selectedUsers={selectedUsers}
                    onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
                    onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
                    multiple={true}
                    excludeIds={[user?.$id, ...collaboratorProfiles.map(p => p.userId || p.$id)].filter(Boolean)}
                />
            </Box>
            <FormControl fullWidth>
                <Select 
                    value={permission} 
                    onChange={(e) => setPermission(e.target.value as PermissionLevel)}
                    sx={{
                        bgcolor: '#0A0908',
                        color: 'white',
                        borderRadius: '12px',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                >
                    <MenuItem value="view">Viewer</MenuItem>
                    <MenuItem value="edit">Editor</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                </Select>
            </FormControl>
            <Button 
                variant="contained" 
                onClick={handleGrant} 
                disabled={loading || selectedUsers.length === 0}
                sx={{ borderRadius: '12px', fontWeight: 700, py: 1.5, bgcolor: '#6366F1' }}
            >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Invite Collaborator'}
            </Button>
        </Stack>
      );
  };

  return (
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
                {editingCollaborator ? 'Manage Access' : 'Share Note'}
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
  );
}
