'use client';

import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Plus,
  FileText,
  Camera,
  Mic,
  Link as LinkIcon,
  X,
  PlusCircle,
} from 'lucide-react';
import { useState } from 'react';

interface QuickCreateFabProps {
  onCreateNote?: () => void;
  onCreateDoodle?: () => void;
  onCreateVoiceNote?: () => void;
  onCreatePhotoNote?: () => void;
  onCreateLinkNote?: () => void;
}

const actions = [
  { icon: <FileText size={20} strokeWidth={1.5} />, name: 'Text Note', action: 'text' },
  { icon: <PlusCircle size={20} strokeWidth={1.5} />, name: 'Doodle', action: 'doodle' },
  { icon: <Mic size={20} strokeWidth={1.5} />, name: 'Voice Note', action: 'voice' },
  { icon: <Camera size={20} strokeWidth={1.5} />, name: 'Photo Note', action: 'photo' },
  { icon: <LinkIcon size={20} strokeWidth={1.5} />, name: 'Link Note', action: 'link' },
];

export default function QuickCreateFab({
  onCreateNote,
  onCreateDoodle,
  onCreateVoiceNote,
  onCreatePhotoNote,
  onCreateLinkNote,
}: QuickCreateFabProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);

  const handleAction = (action: string) => {
    setOpen(false);
    
    switch (action) {
      case 'text':
        onCreateNote?.();
        break;
      case 'doodle':
        onCreateDoodle?.();
        break;
      case 'voice':
        onCreateVoiceNote?.();
        break;
      case 'photo':
        onCreatePhotoNote?.();
        break;
      case 'link':
        onCreateLinkNote?.();
        break;
    }
  };

  // Simple FAB for mobile (handled by bottom nav)
  if (isMobile) {
    return null;
  }

  // SpeedDial for desktop
  return (
    <SpeedDial
      ariaLabel="Quick create"
      sx={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        zIndex: 1000,
        '& .MuiFab-primary': {
          bgcolor: '#6366F1',
          color: '#000000',
          boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            bgcolor: '#00D1DA',
            transform: 'scale(1.1) rotate(90deg)',
            boxShadow: '0 0 50px rgba(99, 102, 241, 0.6)',
          },
        },
        '& .MuiSpeedDialAction-fab': {
          bgcolor: 'rgba(10, 10, 10, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.7)',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(99, 102, 241, 0.1)',
            color: '#6366F1',
            borderColor: '#6366F1',
            transform: 'translateY(-4px)',
          },
        },
        '& .MuiSpeedDialAction-staticTooltipLabel': {
          bgcolor: 'rgba(10, 10, 10, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#FFFFFF',
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
          padding: '6px 12px',
          borderRadius: '8px',
        }
      }}
      icon={<SpeedDialIcon icon={<Plus size={24} strokeWidth={1.5} />} openIcon={<X size={24} strokeWidth={1.5} />} />}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      direction="up"
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.action}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipOpen
          onClick={() => handleAction(action.action)}
        />
      ))}
    </SpeedDial>
  );
}