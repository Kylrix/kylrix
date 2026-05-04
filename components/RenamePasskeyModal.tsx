"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  Button,
  TextField,
  Box,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { AppwriteService } from "@/lib/appwrite";
import toast from "react-hot-toast";

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

interface RenamePasskeyModalProps {
  isOpen: boolean;
  passkey: Passkey | null;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RenamePasskeyModal({
  isOpen,
  passkey,
  onClose,
  onSuccess,
}: RenamePasskeyModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (passkey) {
      setNewName(passkey.name);
    }
  }, [passkey]);

  const handleRename = async () => {
    if (!passkey || !newName.trim()) return;
    setLoading(true);
    try {
      const keychainEntry = await AppwriteService.getKeychainEntry(passkey.id);
      const params = JSON.parse(keychainEntry.params || "{}");
      params.name = newName;
      
      await AppwriteService.updateKeychainEntry(passkey.id, {
        params: JSON.stringify(params)
      });
      
      toast.success("Passkey renamed successfully.");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to rename passkey:", error);
      toast.error("Failed to rename passkey.");
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
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          bgcolor: '#0A0908',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ fontWeight: 800, pt: 3, px: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>Rename Passkey</Box>
      <Box sx={{ px: 3, py: 3, flex: 1, overflowY: 'auto' }}>
        <Box sx={{ pt: 0 }}>
          <TextField
            fullWidth
            label="Passkey Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            variant="filled"
            autoFocus
            InputProps={{
              disableUnderline: true,
              sx: { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          />
        </Box>
      </Box>
      <Box sx={{ p: 3, display: 'flex', gap: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Button onClick={onClose} sx={{ color: 'white', opacity: 0.6, textTransform: 'none' }}>Cancel</Button>
        <Button 
          onClick={handleRename} 
          disabled={loading || !newName.trim() || newName === passkey?.name}
          variant="contained"
          sx={{ borderRadius: '12px', px: 3, textTransform: 'none', fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Rename"}
        </Button>
      </Box>
    </Drawer>
  );
}
