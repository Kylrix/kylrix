'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, TextField, Button, Stack, Select, MenuItem, FormControl } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { grantPermissionSecure, PermissionLevel } from '@/lib/services/internal/unified-permission-service';
import { UsersService } from '@/lib/services/users';
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
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<PermissionLevel>('view');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setIsDrawerOpen(isOpen);
  }, [isOpen, setIsDrawerOpen]);

  const handleGrant = async () => {
    if (!email || !user?.$id) return;
    setLoading(true);
    try {
        const target = await UsersService.lookupUserByEmail(email);
        if (!target) {
            toast.error('User not found');
            return;
        }

        await grantPermissionSecure({
            userId: user.$id,
            resourceId: resourceId,
            resourceType: resourceType,
            resourceTitle: resourceTitle,
            targetUserId: target.userId || target.$id,
            targetEmail: email,
            permission: permission,
            actorName: actorName
        });
        toast.success('Collaborator added!');
        onClose();
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
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
            Manage {resourceType === 'note' ? 'Collaborators' : 'Assignees'}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>
        <Stack spacing={2}>
            <TextField fullWidth label="Collaborator Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormControl fullWidth>
                <Select value={permission} onChange={(e) => setPermission(e.target.value as PermissionLevel)}>
                    <MenuItem value="view">Viewer</MenuItem>
                    <MenuItem value="edit">Editor</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                </Select>
            </FormControl>
            <Button variant="contained" onClick={handleGrant} disabled={loading}>Invite Collaborator</Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
