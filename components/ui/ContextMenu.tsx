'use client';

import React from 'react';
import { 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  alpha
} from '@mui/material';
import { KYLRIX_COLORS, KYLRIX_APP_TONES, KylrixApp } from '@/lib/sdk/design';

interface ContextMenuProps {
  x: number;
  y: number;
  onCloseAction: () => void;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }>;
  appType?: KylrixApp;
}

export function ContextMenu({ x, y, onCloseAction, items, appType }: ContextMenuProps) {
  // Map appType to brand colors
  const activeApp = appType || 'kylrix';
  const toneColor = KYLRIX_APP_TONES[activeApp]?.secondary || KYLRIX_COLORS.ecosystemPrimary;

  return (
    <Menu
      open={true}
      onClose={onCloseAction}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      keepMounted={false}
      disablePortal={true}
      slotProps={{
        paper: {
          sx: {
            minWidth: 220,
            bgcolor: KYLRIX_COLORS.surface, // Opaque surface background as mandated
            border: `1px solid ${alpha(toneColor, 0.25)}`, // Sub-app branded border tint
            borderRadius: '16px',
            backgroundImage: 'none',
            py: 1.25,
            boxShadow: `0 12px 32px rgba(0, 0, 0, 0.6), 0 0 1px 1px ${alpha(toneColor, 0.1)}`,
          }
        }
      }}
    >
      {items.map((item, index) => (
        <MenuItem
          key={index}
          onClick={() => {
            item.onClick();
            onCloseAction();
          }}
          sx={{
            px: 2.5,
            py: 1.25,
            gap: 2,
            color: item.variant === 'destructive' ? '#FF453A' : 'rgba(255, 255, 255, 0.85)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': {
              bgcolor: item.variant === 'destructive' 
                ? 'rgba(255, 69, 58, 0.1)' 
                : alpha(toneColor, 0.08),
              color: item.variant === 'destructive' ? '#FF453A' : toneColor,
            },
            '& .MuiListItemIcon-root': {
              minWidth: 'auto',
              color: 'inherit',
            }
          }}
        >
          {item.icon && <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>}
          <ListItemText 
            primary={item.label} 
            slotProps={{ 
              primary: { 
                sx: { 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  fontFamily: '"Satoshi", sans-serif',
                  letterSpacing: '0.01em'
                } 
              } 
            }} 
          />
        </MenuItem>
      ))}
    </Menu>
  );
}
