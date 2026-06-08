'use client';

import React from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@/lib/mui-tailwind/material';
import { 
  X as CloseIcon,
  Tag as TagIcon,
  Plus,
} from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useTask } from '@/context/TaskContext';

const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const BORDER_HAIRLINE = '#34322F';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
const RADIUS_LARGE = '24px';
const RADIUS_SMALL = '12px';

export function TagSelectorDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close, open } = useUnifiedDrawer();
  const isOpen = activeContent === 'tag-selector';
  const { ecosystemTags } = useTask();

  const onSelect = drawerData?.onSelect as ((tagName: string) => void) | undefined;
  const selectedTags = drawerData?.selectedTags as string[] || [];

  if (!isOpen) return null;

  const handleSelect = (tagName: string) => {
    if (onSelect) onSelect(tagName);
    close();
  };

  const handleCreateNew = () => {
    // Switch to new-tag drawer
    open('new-tag', { 
      onSuccess: () => {
          // After creating a new tag, we might want to go back or just let it be.
          // For now, let's just close or stay in new-tag.
      }
    });
  };

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={close}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      sx={{
        '& .MuiDrawer-paper': {
          height: '50dvh',
          maxHeight: '80dvh',
          borderTopLeftRadius: RADIUS_LARGE,
          borderTopRightRadius: RADIUS_LARGE,
          border: BORDER,
          borderBottom: 0,
          bgcolor: SURFACE_ASH,
          boxShadow: 'none',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: isDesktop ? '600px' : '100%',
          margin: isDesktop ? '0 auto' : '0',
        },
      }}
    >
      <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TagIcon size={20} color={SYSTEM_PRIMARY} />
          <Typography sx={{ color: 'white', fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.1rem' }}>
            SELECT TAGS
          </Typography>
        </Stack>
        <IconButton onClick={close} sx={{ color: TEXT_MUTED, bgcolor: VOID, '&:hover': { bgcolor: HOVER } }}>
          <CloseIcon size={18} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 4 }}>
        <List sx={{ pt: 0 }}>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              onClick={handleCreateNew}
              sx={{ 
                borderRadius: RADIUS_SMALL, 
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                border: '1px dashed rgba(99, 102, 241, 0.3)',
                py: 1.5,
                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' }
              }}
            >
              <Plus size={18} color={SYSTEM_PRIMARY} style={{ marginRight: '12px' }} />
              <ListItemText 
                primary="Create New Tag" 
                primaryTypographyProps={{ sx: { color: SYSTEM_PRIMARY, fontWeight: 800, fontSize: '0.9rem' } }}
              />
            </ListItemButton>
          </ListItem>

          {ecosystemTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.name);
            const color = (tag as any).color || '#9B9691';

            return (
              <ListItem key={tag.$id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  onClick={() => handleSelect(tag.name)}
                  disabled={isSelected}
                  sx={{ 
                    borderRadius: RADIUS_SMALL, 
                    py: 1.5,
                    border: '1px solid transparent',
                    borderColor: isSelected ? color : 'transparent',
                    bgcolor: isSelected ? `${color}10` : 'transparent',
                    '&:hover': { bgcolor: HOVER }
                  }}
                >
                  <Box 
                    sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '4px', 
                      bgcolor: color, 
                      mr: 2,
                      boxShadow: `0 0 10px ${color}40`
                    }} 
                  />
                  <ListItemText 
                    primary={tag.name.toUpperCase()} 
                    primaryTypographyProps={{ 
                      sx: { 
                        color: isSelected ? 'white' : TEXT_MUTED, 
                        fontWeight: 900, 
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.05em'
                      } 
                    }}
                  />
                  {isSelected && (
                    <Typography sx={{ color: color, fontWeight: 900, fontSize: '0.7rem', opacity: 0.8 }}>
                      SELECTED
                    </Typography>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
}
