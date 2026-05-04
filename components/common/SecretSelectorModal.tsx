'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Drawer,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  X,
  Search as SearchIcon,
  Key,
  Shield,
} from 'lucide-react';
import { secrets as secretsApi } from '@/lib/kylrixflow';
import toast from 'react-hot-toast';

interface Secret {
  $id: string;
  name: string;
  username: string;
}

interface SecretSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (secretId: string) => void;
}

export function SecretSelectorModal({ isOpen, onClose, onSelect }: SecretSelectorModalProps) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (isOpen) {
      const fetchSecrets = async () => {
        setLoading(true);
        try {
          const res = await secretsApi.list();
          setSecrets((res.rows || (res as any).documents) as any[]);
        } catch (error: unknown) {
          console.error('Failed to fetch secrets:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchSecrets();
    }
  }, [isOpen]);

  const filtered = secrets.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '24px 24px 0 0',
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 13, 12, 0.98)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 -24px 48px rgba(0, 0, 0, 0.8)',
          maxHeight: { xs: '88dvh', sm: '72vh' },
        },
      }}
    >
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '72vh' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'white', fontFamily: 'var(--font-space-grotesk)' }}>Attach Secret</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resource from Kylrix Vault</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.55)' }}><X size={18} strokeWidth={1.5} /></IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
        <Tabs value={0} onChange={() => {}} sx={{ display: 'none' }}>
          <Tab label="Credentials" />
        </Tabs>
      <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="filled"
            InputProps={{
              disableUnderline: true,
              sx: { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={18} strokeWidth={1.5} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
                </InputAdornment>
              ),
            }}
          />

          {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 0 }}>
              <CircularProgress size={24} sx={{ color: '#6366F1' }} />
            </Box>
          ) : filtered.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, opacity: 0.2, textAlign: 'center' }}>
              <Key size={48} strokeWidth={1} />
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>No secrets found</Typography>
            </Box>
          ) : (
          <List sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {filtered.map((item) => (
                <ListItemButton
                  key={item.$id}
                  onClick={() => onSelect(item.$id)}
                  sx={{
                    borderRadius: '12px',
                    mb: 1,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.05)',
                      borderColor: 'rgba(99, 102, 241, 0.2)',
                      transform: 'translateX(4px)',
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Key size={20} color="#6366F1" strokeWidth={1.5} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={item.username}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: 'white',
                      fontFamily: 'var(--font-space-grotesk)'
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.75rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 500
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
