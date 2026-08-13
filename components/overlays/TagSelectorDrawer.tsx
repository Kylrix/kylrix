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
  ListItemButton} from '@/lib/openbricks/primitives';
import { 
  X as CloseIcon,
  Tag as TagIcon,
  Plus} from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useTask } from '@/context/TaskContext';
import { useNotes } from '@/context/NotesContext';

const SYSTEM_PRIMARY = '#6366F1';

export function TagSelectorDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close, open } = useUnifiedDrawer();
  const isOpen = activeContent === 'tag-selector';
  const { ecosystemTags, refreshEcosystemTags, tasks } = useTask();
  const { notes } = useNotes();
  const [directLocalTags, setDirectLocalTags] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { account } = await import('@/lib/appwrite/client');
        const user = await account.get().catch(() => null);
        const uid = user?.$id || 'guest';
        
        const [c1, c2] = await Promise.all([
          LocalEngine.cacheGet<any>(`f_tags_${uid}`),
          LocalEngine.cacheGet<any>(`f_user_tags_${uid}`),
        ]);
        
        const found =
          c1?.rows && Array.isArray(c1.rows) && c1.rows.length > 0
            ? c1.rows
            : Array.isArray(c1) && c1.length > 0
              ? c1
              : c2?.rows && Array.isArray(c2.rows) && c2.rows.length > 0
                ? c2.rows
                : Array.isArray(c2) && c2.length > 0
                  ? c2
                  : [];
                  
        if (found.length > 0) {
          setDirectLocalTags(found);
        } else {
          const { getAllTags, listTags } = await import('@/lib/appwrite');
          const res = await getAllTags().catch(() => listTags());
          const rows = Array.isArray(res) ? res : (Array.isArray(res?.rows) ? res.rows : []);
          if (rows.length > 0) {
            setDirectLocalTags(rows);
            await LocalEngine.cacheSet(`f_tags_${uid}`, { rows, total: rows.length });
          }
        }
      } catch {}
    })();

    if (!ecosystemTags || ecosystemTags.length === 0) {
      void refreshEcosystemTags();
    }
  }, [isOpen, ecosystemTags, refreshEcosystemTags]);

  const availableTags = React.useMemo(() => {
    const list: { $id: string; name: string; color: string }[] = [];
    const seen = new Set<string>();

    (directLocalTags || []).forEach((t: any) => {
      const name = typeof t === 'string' ? t : t?.name;
      if (name && !seen.has(name)) {
        seen.add(name);
        list.push({ $id: t?.$id || name, name, color: t?.color || SYSTEM_PRIMARY });
      }
    });

    (ecosystemTags || []).forEach((t: any) => {
      const name = typeof t === 'string' ? t : t?.name;
      if (name && !seen.has(name)) {
        seen.add(name);
        list.push({ $id: t?.$id || name, name, color: t?.color || SYSTEM_PRIMARY });
      }
    });

    (tasks || []).forEach((task) => {
      (task.labels || []).forEach((label) => {
        if (label && !seen.has(label)) {
          seen.add(label);
          list.push({ $id: label, name: label, color: SYSTEM_PRIMARY });
        }
      });
    });

    (notes || []).forEach((note: any) => {
      (note.tags || []).forEach((tag: string) => {
        if (tag && !seen.has(tag)) {
          seen.add(tag);
          list.push({ $id: tag, name: tag, color: SYSTEM_PRIMARY });
        }
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [directLocalTags, ecosystemTags, tasks, notes]);

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
          void refreshEcosystemTags();
      }
    });
  };

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={close}
      ModalProps={{ keepMounted: false, disablePortal: false }}
      sx={{
        zIndex: 16000,
        '& .ob-drawer-panel': {
          height: '54dvh',
          maxHeight: '80dvh',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: 0,
          bgcolor: '#161412',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.85)',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: isDesktop ? '580px' : '100%',
          margin: isDesktop ? '0 auto' : '0',
          zIndex: 16000}}}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', color: '#A855F7' }}>
            <TagIcon size={18} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography component="span" sx={{ color: 'white', fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
              Select Tags
            </Typography>
            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.72rem', fontFamily: 'var(--font-satoshi)' }}>
              Attach categories to your idea or goal
            </Typography>
          </Box>
        </Stack>
        <IconButton 
          onClick={close} 
          sx={{ 
            color: 'rgba(255,255,255,0.6)', 
            bgcolor: '#0A0908', 
            border: '1px solid rgba(255,255,255,0.06)', 
            borderRadius: '12px',
            width: 36,
            height: 36,
            '&:hover': { bgcolor: '#1C1A18', color: 'white' } 
          }}
        >
          <CloseIcon size={16} />
        </IconButton>
      </Box>

      {/* List Area with proper inset padding so items never touch container boundaries */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        <List sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={handleCreateNew}
              sx={{ 
                width: '100%',
                borderRadius: '16px', 
                bgcolor: '#0A0908',
                border: '1px dashed rgba(168, 85, 247, 0.35)',
                px: 2.5,
                py: 1.75,
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                '&:hover': { bgcolor: '#1C1A18', borderColor: 'rgba(168, 85, 247, 0.6)' }
              }}
            >
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: 'rgba(168,85,247,0.12)', display: 'grid', placeItems: 'center', color: '#A855F7', flexShrink: 0 }}>
                <Plus size={16} strokeWidth={2.5} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography component="span" sx={{ color: '#C084FC', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Create New Tag
                </Typography>
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: '0.72rem', fontFamily: 'var(--font-satoshi)' }}>
                  Add a new color-coded category
                </Typography>
              </Box>
            </ListItemButton>
          </ListItem>

          {availableTags.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
              No existing tags found. Tap above to create one.
            </Box>
          ) : (
            availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.name || '');
              const color = (tag as any).color || '#A855F7';

              return (
                <ListItem key={tag.$id || tag.name} disablePadding>
                  <ListItemButton 
                    onClick={() => handleSelect(tag.name || '')}
                    disabled={isSelected}
                    sx={{ 
                      width: '100%',
                      borderRadius: '16px', 
                      px: 2.5,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.75,
                      border: '1px solid',
                      borderColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      bgcolor: isSelected ? '#1C1A18' : '#0A0908',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: isSelected ? '#1C1A18' : '#141210', borderColor: 'rgba(255,255,255,0.12)' }
                    }}
                  >
                    <Box 
                      sx={{ 
                        width: 14, 
                        height: 14, 
                        borderRadius: '4px', 
                        bgcolor: color, 
                        flexShrink: 0,
                        boxShadow: `0 0 10px ${color}50`
                      }} 
                    />
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography 
                        component="span"
                        sx={{ 
                          color: isSelected ? 'white' : 'rgba(255,255,255,0.85)', 
                          fontWeight: 800, 
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {(tag.name || '').toUpperCase()}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <Box 
                        sx={{ 
                          color: color, 
                          fontWeight: 900, 
                          fontSize: '0.68rem', 
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.06em',
                          bgcolor: `${color}18`,
                          border: `1px solid ${color}35`,
                          borderRadius: '8px',
                          px: 1.5,
                          py: 0.4
                        }}
                      >
                        SELECTED
                      </Box>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })
          )}
        </List>
      </Box>
    </Drawer>
  );
}
