'use client';

import React from 'react';
import { 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText
} from '@mui/material';

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
}

export function ContextMenu({ x, y, onCloseAction, items }: ContextMenuProps) {
  return (
    <Menu
      open={true}
      onClose={onCloseAction}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      slotProps={{
        paper: {
          sx: {
            minWidth: 200,
            bgcolor: 'rgba(22, 20, 18, 0.99)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            backgroundImage: 'none',
            py: 1,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
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
            color: item.variant === 'destructive' ? '#FF453A' : 'rgba(255, 255, 255, 0.8)',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: item.variant === 'destructive' 
                ? 'rgba(255, 69, 58, 0.1)' 
                : 'rgba(99, 102, 241, 0.1)',
              color: item.variant === 'destructive' ? '#FF453A' : '#6366F1',
            },
            '& .MuiListItemIcon-root': {
              minWidth: 'auto',
              color: 'inherit',
            }
          }}
        >
          {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
          <ListItemText 
            primary={item.label} 
            slotProps={{ 
              primary: { 
                sx: { 
                  fontSize: '0.85rem', 
                  fontWeight: 700,
                  fontFamily: '"Space Grotesk", sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                } 
              } 
            }} 
          />
        </MenuItem>
      ))}
    </Menu>
  );
}

