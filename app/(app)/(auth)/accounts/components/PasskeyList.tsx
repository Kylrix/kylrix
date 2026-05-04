"use client";

import {
  Box,
  Typography,
  IconButton,
  Stack,
  Tooltip
} from '@mui/material';
import { Fingerprint, Edit, Trash2 } from 'lucide-react';
import { AppwriteService } from '@/lib/appwrite';
import toast from 'react-hot-toast';

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

interface PasskeyListProps {
  passkeys: Passkey[];
  email: string;
  onUpdate: () => void;
  onRenameClick: (passkey: Passkey) => void;
}

export default function PasskeyList({ passkeys, onUpdate, onRenameClick }: PasskeyListProps) {
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this passkey?")) return;
    try {
      await AppwriteService.deleteKeychainEntry(id);
      toast.success("Passkey removed successfully.");
      onUpdate();
    } catch (error: unknown) {
      console.error("Failed to delete passkey:", error);
      toast.error("Failed to remove passkey.");
    }
  };

  return (
    <Stack spacing={2}>
      {passkeys.map((pk) => (
        <Box
          key={pk.id}
          sx={{
            backgroundColor: '#161514',
            borderRadius: '12px',
            p: 2,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            overflow: 'hidden',
            transition: 'all 0.2s ease-out',
            '&:hover': {
              backgroundColor: '#1F1D1B',
            },
          }}
        >
          {/* Content Section */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#6366F1',
                  flexShrink: 0,
                }}
              >
                <Fingerprint size={24} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pk.name}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Added {new Date(pk.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Tooltip title="Rename">
              <IconButton
                onClick={() => onRenameClick(pk)}
                size="small"
                sx={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  color: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  transition: 'all 0.2s ease-out',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    color: '#6366F1',
                  },
                }}
              >
                <Edit size={18} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                onClick={() => handleDelete(pk.id)}
                size="small"
                sx={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  color: '#EF4444',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s ease-out',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                  },
                }}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
