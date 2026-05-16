'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, Stack, Select, MenuItem, FormControl } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { grantPermissionSecure, PermissionLevel } from '@/lib/services/internal/unified-permission-service';
import UserSearch from '@/components/UserSearch';
import { useAuth } from '@/context/auth/AuthContext';
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
  const [permission, setPermission] = useState<PermissionLevel>('view');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
  }, [isOpen, setIsDrawerOpen]);

  const handleGrant = async () => {
    if (selectedUsers.length === 0 || !user?.$id) return;
    setLoading(true);
    let successCount = 0;

    try {
        for (const targetUser of selectedUsers) {
            await grantPermissionSecure({
                userId: user.$id,
                resourceId: resourceId,
                resourceType: resourceType,
                resourceTitle: resourceTitle,
                targetUserId: targetUser.id,
                permission: permission,
                actorName: actorName
            });
            successCount++;
        }
        
        if (successCount === selectedUsers.length) {
            toast.success(`${resourceType === 'note' ? 'Collaborator(s)' : 'Assignee(s)'} added!`);
            onClose();
        } else {
            toast.error('Some invitations failed.');
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
            Manage {resourceType === 'note' ? 'Collaborators' : 'Assignees'}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>
        <Stack spacing={3}>
            <Box>
                <UserSearch 
                    label={resourceType === 'note' ? "COLLABORATOR(S)" : "ASSIGNEE(S)"}
                    placeholder="Search by name or @username"
                    selectedUsers={selectedUsers}
                    onSelect={(newUser) => setSelectedUsers([...selectedUsers, newUser])}
                    onRemove={(id) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id))}
                    multiple={true}
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
                {loading ? 'Inviting...' : `Invite ${resourceType === 'note' ? 'Collaborator' : 'Assignee'}`}
            </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
