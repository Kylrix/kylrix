"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Divider,
  alpha
} from '@mui/material';
import { Close as CloseIcon, Keyboard as KeyboardIcon } from '@mui/icons-material';

interface ShortcutProps {
  keys: string[];
  description: string;
}

const Shortcut = ({ keys, description }: ShortcutProps) => (
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
    <Box sx={{ flex: 1 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
        {description}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      {keys.map((key, index) => (
        <Typography
          key={index}
          component="kbd"
          sx={{
            px: 1.2,
            py: 0.6,
            borderRadius: '8px',
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#6366F1',
            fontSize: '0.75rem',
            fontWeight: 800,
            fontFamily: 'monospace',
            minWidth: '24px',
            textAlign: 'center',
            boxShadow: '0 4px 0 rgba(0,0,0,0.3)'
          }}
        >
          {key}
        </Typography>
      ))}
    </Box>
  </Box>
);

const shortcuts = {
  general: [
    { keys: ['⌘', 'K'], description: 'Open quick search' },
    { keys: ['⌘', 'N'], description: 'Create new note' },
    { keys: ['⌘', '⇧', 'F'], description: 'Toggle fullscreen' },
    { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' }
  ],
  editor: [
    { keys: ['⌘', 'S'], description: 'Save changes' },
    { keys: ['⌘', 'B'], description: 'Bold text' },
    { keys: ['⌘', 'I'], description: 'Italic text' },
    { keys: ['⌘', 'U'], description: 'Underline text' },
    { keys: ['⌘', '⇧', '7'], description: 'Toggle numbered list' },
    { keys: ['⌘', '⇧', '8'], description: 'Toggle bullet list' },
    { keys: ['⌘', '['], description: 'Decrease indent' },
    { keys: ['⌘', ']'], description: 'Increase indent' }
  ],
  navigation: [
    { keys: ['⌘', '←'], description: 'Go back' },
    { keys: ['⌘', '→'], description: 'Go forward' },
    { keys: ['⌘', '↑'], description: 'Jump to top' },
    { keys: ['⌘', '↓'], description: 'Jump to bottom' }
  ],
  organization: [
    { keys: ['⌘', '⇧', 'N'], description: 'Create new collection' },
    { keys: ['⌘', '⇧', 'T'], description: 'Add tag' },
    { keys: ['⌘', '⇧', 'M'], description: 'Move to collection' },
    { keys: ['⌘', '⇧', 'S'], description: 'Share note' }
  ]
};

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  const [platform, setPlatform] = useState('mac');

  useEffect(() => {
    // Detect platform
    setPlatform((typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')) ? 'mac' : 'windows');
  }, []);

  const replaceKeys = (keys: string[]) => {
    if (platform === 'windows') {
      return keys.map(key => 
        key === '⌘' ? 'Ctrl' :
        key === '⇧' ? 'Shift' :
        key === '⌥' ? 'Alt' :
        key
      );
    }
    return keys;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          backgroundImage: 'none',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 3,
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <KeyboardIcon sx={{ color: '#6366F1' }} />
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
            Keyboard Shortcuts
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 6 }}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', mb: 3 }}>
              General
            </Typography>
            {shortcuts.general.map((shortcut, index) => (
              <Shortcut 
                key={index}
                keys={replaceKeys(shortcut.keys)}
                description={shortcut.description}
              />
            ))}

            <Divider sx={{ my: 4, borderColor: 'rgba(255, 255, 255, 0.05)' }} />

            <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', mb: 3 }}>
              Editor
            </Typography>
            {shortcuts.editor.map((shortcut, index) => (
              <Shortcut
                key={index}
                keys={replaceKeys(shortcut.keys)}
                description={shortcut.description}
              />
            ))}
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', mb: 3 }}>
              Navigation
            </Typography>
            {shortcuts.navigation.map((shortcut, index) => (
              <Shortcut
                key={index}
                keys={replaceKeys(shortcut.keys)}
                description={shortcut.description}
              />
            ))}

            <Divider sx={{ my: 4, borderColor: 'rgba(255, 255, 255, 0.05)' }} />

            <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', mb: 3 }}>
              Organization
            </Typography>
            {shortcuts.organization.map((shortcut, index) => (
              <Shortcut
                key={index}
                keys={replaceKeys(shortcut.keys)}
                description={shortcut.description}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ 
          mt: 4, 
          p: 2.5, 
          bgcolor: alpha('#6366F1', 0.03), 
          border: '1px solid',
          borderColor: alpha('#6366F1', 0.1),
          borderRadius: '16px' 
        }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
            Pro Tip: Press <Box component="kbd" sx={{ px: 1, py: 0.2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white' }}>{platform === 'mac' ? '⌘' : 'Ctrl'}</Box> + <Box component="kbd" sx={{ px: 1, py: 0.2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white' }}>/</Box> anywhere in the app to show these shortcuts
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

