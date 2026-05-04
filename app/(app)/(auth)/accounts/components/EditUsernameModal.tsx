'use client';

import { useColors } from '@/lib/theme-context';
import { useState } from 'react';
import { account, AppwriteService } from '@/lib/appwrite';
import {
  Drawer,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';

interface EditUsernameModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSuccess: (newName: string) => void;
}

export default function EditUsernameModal({
  isOpen,
  currentName,
  onClose,
  onSuccess,
}: EditUsernameModalProps) {
  const dynamicColors = useColors();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [newName, setNewName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!newName.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (newName.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Update the account name
      await account.updateName(newName.trim());
      
      // 2. Update the username and last_username_edit timestamp in prefs
      // This allows all apps in the ecosystem to resolve the username instantly via account.get()
      const currentPrefs = await account.getPrefs();
      await account.updatePrefs({
        ...currentPrefs,
        username: newName.trim().toLowerCase(),
        last_username_edit: new Date().toISOString(),
      });

      await AppwriteService.recordProfileEvent({
        type: 'username_change',
        userId: (await account.get()).$id,
        newUsername: newName.trim().toLowerCase(),
        profilePatch: {
          username: newName.trim().toLowerCase(),
          displayName: newName.trim(),
          bio: currentPrefs?.bio || '',
        },
        metadata: {
          source: 'accounts.edit-username-modal',
        },
      });

      onSuccess(newName.trim());
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          backgroundColor: dynamicColors.secondary,
          backgroundImage: 'none',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ color: 'white', fontWeight: 700, px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        Edit Username
      </Box>
      <Box sx={{ px: 3, pt: 3, flex: 1, overflowY: 'auto' }}>
          <Typography sx={{ color: dynamicColors.foreground, mb: 2, fontSize: '0.875rem' }}>
            Choose a new username for your account. This name will be visible to other users.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            value={newName}
            onChange={(_e) => setNewName(_e.target.value.toLowerCase().replace(/\s/g, ''))}
            disabled={loading}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: dynamicColors.primary,
                },
              },
              '& .MuiInputLabel-root': {
                color: dynamicColors.foreground,
                '&.Mui-focused': {
                  color: dynamicColors.primary,
                },
              },
            }}
          />
        </Box>
      <Box sx={{ p: 3, pt: 0, display: 'flex', gap: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Button
          onClick={onClose}
          sx={{
            color: 'white',
            textTransform: 'none',
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          disabled={loading || !newName.trim() || newName === currentName}
          sx={{
            backgroundColor: dynamicColors.primary,
            color: dynamicColors.secondary,
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '0.5rem',
            px: 3,
            '&:hover': { backgroundColor: '#00D1DA' },
            '&.Mui-disabled': {
              backgroundColor: 'rgba(99, 102, 241, 0.3)',
              color: 'rgba(0, 0, 0, 0.3)',
            },
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
        </Button>
      </Box>
    </Drawer>
  );
}
