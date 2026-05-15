'use client';

import React, { useState } from 'react';
import { Box, Typography, IconButton, TextField, Button, Stack, Select, MenuItem, Divider } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { grantPermissionSecure, PermissionLevel } from '@/lib/services/internal/unified-permission-service';
import toast from 'react-hot-toast';

const DRAWER_SX = {
  borderTopLeftRadius: '26px',
  borderTopRightRadius: '26px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  import { grantPermissionSecure, PermissionLevel } from '@/lib/services/internal/unified-permission-service';
  import { UsersService } from '@/lib/services/users';
  import { useAuth } from '@/context/auth/AuthContext';
  import toast from 'react-hot-toast';
  ...
  export function CollaboratorManager({ isOpen, onClose, resourceId, resourceType, resourceTitle, actorName }: { ... }) {
    const { user } = useAuth();
  ...
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
              resourceId,
              resourceType,
              resourceTitle,
              targetUserId: target.userId,
              targetEmail: email,
              permission,
              actorName
          });
          toast.success('Collaborator added!');
          onClose();
      } catch {
          toast.error('Failed to add collaborator');
      } finally {
          setLoading(false);
      }
    };

    }
  };

  return (
    <Drawer anchor="bottom" open={isOpen} onClose={onClose} PaperProps={{ sx: DRAWER_SX }} ModalProps={{ keepMounted: false, disableScrollLock: false }}>
      <Box sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
            Manage {resourceType === 'note' ? 'Collaborators' : 'Assignees'}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></IconButton>
        </Box>
        <Stack spacing={2}>
            <TextField fullWidth label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={permission} onChange={(e) => setPermission(e.target.value as PermissionLevel)}>
                <MenuItem value="view">Viewer</MenuItem>
                <MenuItem value="edit">Editor</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
            </Select>
            <Button variant="contained" onClick={handleGrant} disabled={loading}>Grant Access</Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
