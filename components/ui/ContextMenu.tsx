'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  alpha,
  Box
} from '@/lib/mui-tailwind/material';
import { KYLRIX_COLORS, KYLRIX_APP_TONES, KylrixApp } from '@/lib/sdk/design';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
  variant?: 'default' | 'destructive';
  keepOpen?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onCloseAction: () => void;
  items: ContextMenuItem[];
  appType?: KylrixApp;
}

export function ContextMenu({ x, y, onCloseAction, items, appType }: ContextMenuProps) {
  // Map appType to brand colors
  const activeApp = appType || 'kylrix';
  const toneColor = KYLRIX_APP_TONES[activeApp]?.secondary || KYLRIX_COLORS.ecosystemPrimary;

  // Navigation Stack for Dynamic Sub-menus
  const [menuStack, setMenuStack] = useState<ContextMenuItem[][]>([items]);
  const currentItems = menuStack[menuStack.length - 1];
  const isSubmenu = menuStack.length > 1;

  useEffect(() => {
    setMenuStack((prev) => {
      if (prev.length <= 1) return [items];
      const prevSubmenu = prev[1];
      if (!prevSubmenu) return [items];
      const parentItem = items.find(
        (item) =>
          item.submenu &&
          item.submenu.length === prevSubmenu.length &&
          item.submenu.every((entry, index) => entry.label === prevSubmenu[index]?.label),
      );
      if (parentItem?.submenu) return [items, parentItem.submenu];
      return [items];
    });
  }, [items]);

  const handleBack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuStack(prev => prev.slice(0, -1));
  }, []);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.submenu) {
      setMenuStack(prev => [...prev, item.submenu!]);
      return;
    }
    if (item.onClick) {
      item.onClick();
      if (!item.keepOpen) {
        onCloseAction();
      }
    }
  };

  return (
    <Menu
      open={true}
      onClose={onCloseAction}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      keepMounted={false}
      disablePortal={true}
      data-kylrix-context-menu
      slotProps={{
        paper: {
          sx: {
            minWidth: 240,
            bgcolor: KYLRIX_COLORS.surface, 
            border: `1px solid ${alpha(toneColor, 0.2)}`, 
            borderRadius: '20px',
            backgroundImage: 'none',
            py: 1,
            boxShadow: `0 24px 48px rgba(0, 0, 0, 0.7), 0 0 1px 1px ${alpha(toneColor, 0.05)}`,
          }
        }
      }}
    >
      {/* 🔙 Dynamic Back Button for Sub-menus */}
      {isSubmenu && (
        <MenuItem
            onClick={handleBack}
            sx={{
                px: 2,
                py: 1,
                mb: 0.5,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.4)',
                '&:hover': {
                    bgcolor: 'transparent',
                    color: 'white'
                }
            }}
        >
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                <ChevronLeft size={16} />
            </ListItemIcon>
            <ListItemText 
                primary="Back"
                slotProps={{ primary: { sx: { fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' } } }}
            />
        </MenuItem>
      )}

      {currentItems.map((item, index) => (
        <MenuItem
          key={index}
          onClick={() => handleItemClick(item)}
          sx={{
            px: 2.5,
            py: 1.5,
            gap: 2,
            color: item.variant === 'destructive' ? '#FF453A' : 'rgba(255, 255, 255, 0.85)',
            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            borderRadius: '12px',
            mx: 1,
            '&:hover': {
              bgcolor: item.variant === 'destructive' 
                ? 'rgba(255, 69, 58, 0.1)' 
                : alpha(toneColor, 0.08),
              color: item.variant === 'destructive' ? '#FF453A' : toneColor,
              transform: 'translateX(4px)'
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
                  fontSize: '0.88rem', 
                  fontWeight: 600,
                  fontFamily: '"Satoshi", sans-serif',
                  letterSpacing: '0.01em'
                } 
              } 
            }} 
          />
          {item.submenu && (
            <Box sx={{ ml: 'auto', opacity: 0.3 }}>
                <ChevronRight size={14} />
            </Box>
          )}
        </MenuItem>
      ))}
    </Menu>
  );
}
