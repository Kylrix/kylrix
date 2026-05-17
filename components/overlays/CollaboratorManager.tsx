'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Button, Stack, Select, MenuItem, FormControl, alpha } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { grantPermissionSecure, getResourceCollaboratorsSecure, PermissionLevel } from '@/lib/actions/secure-ops';
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

export function CollaboratorManager({ isOpen, onClose, resourceId, resourceType, resourceTitle, actorName }: { 
    isOpen: boolean; 
    onClose: () => void;
    resourceId: string;
    resourceType: 'note' | 'task';
    resourceTitle: string;
    actorName: string;
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [assigneeProfiles, setAssigneeProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('view');
  const [loading, setLoading] = useState(false);

  const isFlow = resourceType === 'task';
  const labelSingular = isFlow ? 'Assignee' : 'Collaborator';
  const labelPlural = isFlow ? 'Assignees' : 'Collaborators';

  const fetchExistingAssignees = useCallback(async () => {
    if (!resourceId) return;
    
    // Defer slightly for smooth animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsLoadingExisting(true);
    try {
        const { jwt } = await account.createJWT();
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId,
            resourceType,
            jwt
        });
        setAssigneeProfiles(collaborators);
    } catch (err) {
        console.error(`Failed to fetch existing ${labelPlural.toLowerCase()}:`, err);
    } finally {
        setIsLoadingExisting(false);
    }
  }, [resourceId, resourceType, labelPlural]);

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (isOpen && resourceId) {
        fetchExistingAssignees();
    }
  }, [isOpen, resourceId, setIsDrawerOpen, fetchExistingAssignees]);

  const handleGrant = async () => {
    if (selectedUsers.length === 0 || !user?.$id) return;
    setLoading(true);
    let successCount = 0;

    try {
        const { jwt } = await account.createJWT();
        for (const targetUser of selectedUsers) {
            await grantPermissionSecure({
                userId: user.$id,
                resourceId,
                resourceType,
                resourceTitle,
                targetUserId: targetUser.id,
                permission,
                actorName,
                jwt
            });
            successCount++;
        }
        
        if (successCount === selectedUsers.length) {
            toast.success(`${labelSingular}s added!`);
            fetchExistingAssignees();
            setSelectedUsers([]);
            onClose();
        } else {
            toast.error('Some invitations failed.');
        }
    } catch (err: any) {
        toast.error(err.message || `Failed to add ${labelSingular.toLowerCase()}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: DRAWER_SX }} ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}>
      <Box sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
            Manage {labelPlural}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>
        <Stack spacing={3}>
            {assigneeProfiles.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5, display: 'block' }}>
                        EXISTING {labelPlural.toUpperCase()}
                    </Typography>
                    <Stack spacing={1}>
                        {assigneeProfiles.map((profile) => (
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
                                                bgcolor: alpha(isFlow ? '#A855F7' : '#6366F1', 0.1),
                                                color: isFlow ? '#A855F7' : '#6366F1',
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
                    label={`INVITE NEW ${labelPlural.toUpperCase()}`}
                    placeholder="Search by name or @username"
                    selectedUsers={selectedUsers}
                    onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
                    onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
                    multiple={true}
                    excludeIds={assigneeProfiles.map(p => p.userId || p.$id)}
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
                sx={{ borderRadius: '12px', fontWeight: 700, py: 1.5, bgcolor: isFlow ? '#A855F7' : '#6366F1' }}
            >
                {loading ? 'Inviting...' : `Invite ${labelSingular}`}
            </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
