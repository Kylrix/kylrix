'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Button, Stack, Select, MenuItem, FormControl } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { grantPermissionSecure, PermissionLevel } from '@/lib/actions/secure-ops';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/context/auth/AuthContext';
import { account, getNote } from '@/lib/appwrite';
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
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('view');
  const [loading, setLoading] = useState(false);

  const fetchExistingCollaborators = React.useCallback(async () => {
    if (!noteId) return;
    
    // Defer slightly to allow drawer animation to complete smoothly
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsLoadingExisting(true);
    try {
        const { getResourceCollaboratorsSecure } = await import('@/lib/actions/secure-ops');
        const { account } = await import('@/lib/appwrite');
        const { jwt } = await account.createJWT();

        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: noteId,
            resourceType: 'note',
            jwt: jwt
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
    }
  }, [isOpen, noteId, setIsDrawerOpen, fetchExistingCollaborators]);

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

  return (
    <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: DRAWER_SX }} ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}>
      <Box sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
            Share Note
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>
        <Stack spacing={3}>
            {collaboratorProfiles.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5, display: 'block' }}>
                        EXISTING COLLABORATORS
                    </Typography>
                    <Stack spacing={1}>
                        {collaboratorProfiles.map((profile) => (
                            <Box key={profile.$id || profile.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
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
                    excludeIds={collaboratorProfiles.map(p => p.userId || p.$id)}
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
                {loading ? 'Inviting...' : 'Invite Collaborator'}
            </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
