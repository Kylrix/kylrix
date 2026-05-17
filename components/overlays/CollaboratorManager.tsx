'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Button, Stack, Select, MenuItem, FormControl, alpha, CircularProgress } from '@mui/material';
import { X, ArrowLeft, Trash2 } from 'lucide-react';
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

export function CollaboratorManager({ isOpen, onClose, resourceId, resourceType, resourceTitle, actorName }: { 
    isOpen: boolean; 
    onClose: () => void;
    resourceId: string;
    resourceType: 'note' | 'task';
    resourceTitle: string;
    actorName: string;
}) {
  const { setIsDrawerOpen } = useDrawerState();
  const { drawerData } = useUnifiedDrawer();
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [assigneeProfiles, setAssigneeProfiles] = useState<any[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('viewer');
  const [loading, setLoading] = useState(false);
  
  // Edit specific assignee state
  const [editingAssignee, setEditingAssignee] = useState<any | null>(null);

  const isFlow = resourceType === 'task';
  const labelSingular = isFlow ? 'Assignee' : 'Collaborator';
  const labelPlural = isFlow ? 'Assignees' : 'Collaborators';
  const brandColor = isFlow ? '#A855F7' : '#6366F1';

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
        
        // Handle direct entry into Edit Mode from external triggers
        if (drawerData?.initialCollaborator) {
            setEditingAssignee(drawerData.initialCollaborator);
            setPermission(drawerData.initialCollaborator.permissionLevel || 'viewer');
        }
    }
    if (!isOpen) {
        setEditingAssignee(null);
        setSelectedUsers([]);
    }
  }, [isOpen, resourceId, setIsDrawerOpen, fetchExistingAssignees, drawerData?.initialCollaborator]);

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

  const handleUpdateAssignee = async () => {
      if (!editingAssignee || !user?.$id) return;
      setLoading(true);
      try {
          const { jwt } = await account.createJWT();
          await grantPermissionSecure({
              userId: user.$id,
              resourceId,
              resourceType,
              resourceTitle,
              targetUserId: editingAssignee.userId,
              permission: permission,
              actorName,
              jwt,
              skipEmail: true // SILENT update
          });
          toast.success('Access updated');
          fetchExistingAssignees();
          setEditingAssignee(null);
      } catch (err: any) {
          toast.error(err.message || 'Failed to update access');
      } finally {
          setLoading(false);
      }
  };

  const handleRevokeAssignee = async () => {
      if (!editingAssignee || !user?.$id) return;
      if (!window.confirm(`Are you sure you want to remove ${editingAssignee.displayName || editingAssignee.username}?`)) return;
      
      setLoading(true);
      try {
          const { jwt } = await account.createJWT();
          await revokePermissionSecure({
              resourceId,
              resourceType,
              targetUserId: editingAssignee.userId,
              jwt
          });
          toast.success(`${labelSingular} removed`);
          fetchExistingAssignees();
          setEditingAssignee(null);
      } catch (err: any) {
          toast.error(err.message || `Failed to remove ${labelSingular.toLowerCase()}`);
      } finally {
          setLoading(false);
      }
  };

  const renderContent = () => {
      if (editingAssignee) {
          return (
            <Stack spacing={4}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <IdentityAvatar
                        fileId={editingAssignee.avatar}
                        alt={editingAssignee.displayName}
                        fallback={(editingAssignee.displayName || 'U').charAt(0).toUpperCase()}
                        size={48}
                        verified={editingAssignee.verified}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'white', noWrap: true }}>{editingAssignee.displayName || editingAssignee.username}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', noWrap: true }}>@{editingAssignee.username}</Typography>
                    </Box>
                </Stack>

                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 900, color: brandColor, mb: 1.5, display: 'block', letterSpacing: '0.1em' }}>
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
                            <MenuItem value="viewer">Viewer</MenuItem>
                            <MenuItem value="editor">Editor</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Stack spacing={2}>
                    <Button 
                        variant="contained" 
                        fullWidth
                        onClick={handleUpdateAssignee}
                        disabled={loading}
                        sx={{ borderRadius: '14px', fontWeight: 800, py: 1.75, bgcolor: brandColor }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Update Access'}
                    </Button>
                    <Button 
                        variant="outlined" 
                        fullWidth
                        color="error"
                        onClick={handleRevokeAssignee}
                        disabled={loading}
                        sx={{ borderRadius: '14px', fontWeight: 700, py: 1.5, borderColor: alpha('#ef4444', 0.3), '&:hover': { bgcolor: alpha('#ef4444', 0.05) } }}
                    >
                        Remove {labelSingular}
                    </Button>
                </Stack>
            </Stack>
          );
      }

      return (
        <Stack spacing={3}>
            {assigneeProfiles.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em', mb: 1.5, display: 'block' }}>
                        EXISTING {labelPlural.toUpperCase()}
                    </Typography>
                    <Stack spacing={1}>
                        {assigneeProfiles.map((profile) => (
                            <Box 
                                key={profile.$id || profile.userId} 
                                onClick={() => {
                                    setEditingAssignee(profile);
                                    setPermission(profile.permissionLevel || 'viewer');
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
                                                bgcolor: alpha(brandColor, 0.1),
                                                color: brandColor,
                                                fontWeight: 800,
                                                fontSize: '9px',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            {profile.permissionLevel || 'viewer'}
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
                    excludeIds={[user?.$id, ...assigneeProfiles.map(p => p.userId || p.$id)].filter(Boolean)}
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
                    <MenuItem value="viewer">Viewer</MenuItem>
                    <MenuItem value="editor">Editor</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                </Select>
            </FormControl>
            <Button 
                variant="contained" 
                onClick={handleGrant} 
                disabled={loading || selectedUsers.length === 0}
                sx={{ borderRadius: '12px', fontWeight: 700, py: 1.5, bgcolor: brandColor }}
            >
                {loading ? <CircularProgress size={20} color="inherit" /> : `Invite ${labelSingular}`}
            </Button>
        </Stack>
      );
  };

  return (
    <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: DRAWER_SX }} ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}>
      <Box sx={{ p: 2.75, pb: 'calc(2.75rem + env(safe-area-inset-bottom))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {editingAssignee && (
                  <IconButton size="small" onClick={() => setEditingAssignee(null)} sx={{ color: 'rgba(255,255,255,0.5)', ml: -1 }}>
                      <ArrowLeft size={20} />
                  </IconButton>
              )}
              <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                {editingAssignee ? 'Manage Access' : `Manage ${labelPlural}`}
              </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>

        {isLoadingExisting && !editingAssignee ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress color="primary" />
            </Box>
        ) : renderContent()}
      </Box>
    </Drawer>
  );
}
