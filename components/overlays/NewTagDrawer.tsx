'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  CircularProgress, 
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  Paper
} from '@/lib/openbricks/primitives';
import { 
  X as CloseIcon,
  Tag as TagIcon,
  ArrowUpRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Tags } from '@/types/appwrite';
import { createTag, updateTag } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { ID } from 'appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useSection } from '@/context/SectionContext';
import { useTask } from '@/context/TaskContext';

const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const BORDER_HAIRLINE = '#34322F';
const SYSTEM_PRIMARY = '#6366F1';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
const RADIUS_LARGE = '24px';
const RADIUS_SMALL = '12px';

const predefinedColors = [
  '#6366F1', // Electric Teal
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export function NewTagDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { setActiveDetail } = useSection();
  const { pushLiveTag } = useTask();
  const isOpen = activeContent === 'new-tag';
  const { user } = useAuth();
  
  const editingTag = drawerData?.tag as Tags | undefined;
  const onSuccess = drawerData?.onSuccess as (() => void) | undefined;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1'});
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft when drawer opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || editingTag) {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:tag');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        setFormData(draft);
      } catch (e) {
        console.error('Failed to parse tag draft', e);
      }
    }
    setIsHydrated(true);
  }, [isOpen, editingTag]);

  // Save draft on changes
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !isHydrated || editingTag) return;
    if (formData.name.trim() || formData.description.trim()) {
      localStorage.setItem('kylrix:draft:tag', JSON.stringify(formData));
    } else {
      localStorage.removeItem('kylrix:draft:tag');
    }
  }, [isOpen, isHydrated, formData, editingTag]);

  useEffect(() => {
    if (isOpen) {
      if (editingTag) {
        setFormData({
          name: editingTag.name || '',
          description: editingTag.description || '',
          color: editingTag.color || '#6366F1'});
      } else {
        setFormData({
          name: '',
          description: '',
          color: '#6366F1'});
      }
      setError(null);
    }
  }, [isOpen, editingTag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.$id || !formData.name.trim()) return;

    setIsSaving(true);
    setError(null);

    const tagName = formData.name.trim();
    const tagId = editingTag ? editingTag.$id : ID.unique();
    const now = new Date().toISOString();
    const liveTag: Tags = {
      $id: tagId,
      name: tagName,
      nameLower: tagName.toLowerCase(),
      description: formData.description.trim(),
      color: formData.color,
      userId: user.$id,
      $createdAt: editingTag?.$createdAt || now,
      $updatedAt: now} as any;

    pushLiveTag(liveTag);

    try {
      if (editingTag) {
        await updateTag(editingTag.$id, {
          name: tagName,
          description: formData.description.trim(),
          color: formData.color});
      } else {
        await createTag({
          name: tagName,
          description: formData.description.trim(),
          color: formData.color});
      }
      
      if (!editingTag && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:tag');
      }
      if (onSuccess) onSuccess();
      close();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMorphToDetail = async () => {
    if (!user?.$id || !formData.name.trim()) return;

    setIsSaving(true);
    setError(null);

    const tagName = formData.name.trim();
    const tagId = editingTag ? editingTag.$id : ID.unique();
    const now = new Date().toISOString();
    const liveTag: Tags = {
      $id: tagId,
      name: tagName,
      nameLower: tagName.toLowerCase(),
      description: formData.description.trim(),
      color: formData.color,
      userId: user.$id,
      $createdAt: editingTag?.$createdAt || now,
      $updatedAt: now} as any;

    pushLiveTag(liveTag);

    try {
      let savedTag: any;
      if (editingTag) {
        savedTag = await updateTag(editingTag.$id, {
          name: tagName,
          description: formData.description.trim(),
          color: formData.color});
      } else {
        savedTag = await createTag({
          name: tagName,
          description: formData.description.trim(),
          color: formData.color});
      }
      
      if (!editingTag && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:tag');
      }
      if (onSuccess) onSuccess();
      const targetTag = savedTag || liveTag;
      setActiveDetail({ type: 'tag', id: targetTag.$id || targetTag.id || tagName, data: targetTag });
      close();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setIsSaving(false);
    }
  };

  const fontDisplay = 'var(--font-clash)';

  if (!isOpen) return null;

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={isOpen}
      onClose={close}
      ModalProps={{ keepMounted: false, disablePortal: false }}
      sx={{
        zIndex: 17000,
        '& .ob-drawer-panel': {
          ...(isDesktop
            ? {
                top: '88px',
                right: 0,
                height: 'calc(100vh - 88px)',
                width: 'min(460px, 94vw)',
                maxWidth: 'min(460px, 94vw)',
                borderTopLeftRadius: RADIUS_LARGE,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderLeft: BORDER,
                borderTop: BORDER,
                borderBottom: 0,
                borderRight: 0,
                zIndex: 17000}
            : {
                height: isExpanded ? '100dvh' : '60dvh',
                minHeight: '60dvh',
                maxHeight: '100dvh',
                transition: BRAND_TRANSITION,
                borderTopLeftRadius: RADIUS_LARGE,
                borderTopRightRadius: RADIUS_LARGE,
                border: BORDER,
                borderBottom: 0,
                zIndex: 17000}),
          bgcolor: SURFACE_ASH,
          boxShadow: '0 -24px 60px rgba(0,0,0,0.85)',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'}}}
    >
      <Box
        sx={{
          px: { xs: 2.25, sm: 2.75 },
          pb: 'max(20px, env(safe-area-inset-bottom))',
          pt: 3,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0}}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: RADIUS_SMALL,
                display: 'grid',
                placeItems: 'center',
                bgcolor: VOID,
                border: BORDER}}
            >
              <TagIcon size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />
            </Box>
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 900,
                fontSize: '1.25rem',
                fontFamily: fontDisplay,
                letterSpacing: '-0.02em'}}
            >
              {editingTag ? 'Edit Tag' : 'New Tag'}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {formData.name.trim().length > 0 && (
              <IconButton 
                onClick={handleMorphToDetail} 
                aria-label="Go Full Detail"
                title="Go Full Detail"
                sx={{
                  color: '#F59E0B',
                  bgcolor: VOID,
                  border: BORDER,
                  borderRadius: RADIUS_SMALL,
                  '&:hover': { bgcolor: HOVER }
                }}
              >
                <ArrowUpRight size={18} />
              </IconButton>
            )}
            {!isDesktop && (
              <IconButton 
                onClick={() => setIsExpanded(!isExpanded)} 
                aria-label="Toggle Fullscreen"
                sx={{
                  color: '#E8E6E3',
                  bgcolor: VOID,
                  border: BORDER,
                  borderRadius: RADIUS_SMALL,
                  '&:hover': { bgcolor: HOVER }
                }}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </IconButton>
            )}
            <IconButton
              onClick={close}
              aria-label="Close"
              sx={{
                color: '#E8E6E3',
                bgcolor: VOID,
                border: BORDER,
                borderRadius: RADIUS_SMALL,
                '&:hover': { bgcolor: HOVER }}}
            >
              <CloseIcon size={18} />
            </IconButton>
          </Stack>
        </Stack>

        <Box 
          component="form" 
          onSubmit={handleSubmit}
          sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            overflowY: 'auto',
            pr: 0.5
          }}
        >
          {error && (
            <Paper sx={{ p: 1.5, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
              <Typography sx={{ color: '#FCA5A5', fontSize: '0.8rem', fontWeight: 600 }}>{error}</Typography>
            </Paper>
          )}

          {/* Tag Name Input */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography component="span" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Tag Name
            </Typography>
            <input
              type="text"
              required
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Research, Work, High Priority"
              className="w-full bg-[#0A0908] border border-white/10 focus:border-[#A855F7] rounded-2xl px-4 py-3 text-sm text-white font-satoshi font-semibold placeholder-white/20 focus:outline-none transition-all"
            />
          </Box>

          {/* Description Input */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography component="span" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Description <span style={{ opacity: 0.5 }}>(Optional)</span>
            </Typography>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief context or use-case for this tag..."
              className="w-full bg-[#0A0908] border border-white/10 focus:border-[#A855F7] rounded-2xl px-4 py-3 text-sm text-white font-satoshi placeholder-white/20 focus:outline-none transition-all resize-none"
            />
          </Box>

          {/* Color Palette Picker */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography component="span" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Color Theme
            </Typography>
            <div className="flex flex-wrap gap-2.5">
              {predefinedColors.map((color) => {
                const isSelected = formData.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className="w-8 h-8 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    style={{
                      backgroundColor: color,
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 14px ${color}80` : 'none',
                      outline: isSelected ? '2px solid white' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                );
              })}
            </div>

            {/* Custom Color Input & Live Preview */}
            <div className="mt-2 p-3 bg-[#0A0908] border border-white/5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer bg-transparent border-0"
                  />
                </div>
                <span className="text-white text-xs font-mono font-bold tracking-wider">
                  {formData.color.toUpperCase()}
                </span>
              </div>

              {formData.name.trim() && (
                <div
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-extrabold tracking-wider uppercase border"
                  style={{
                    color: formData.color,
                    borderColor: `${formData.color}40`,
                    backgroundColor: `${formData.color}15`,
                  }}
                >
                  {formData.name.toUpperCase()}
                </div>
              )}
            </div>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ mt: 'auto', pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <button
              type="submit"
              disabled={isSaving || !formData.name.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#A855F7] hover:bg-[#9333EA] disabled:opacity-40 disabled:hover:bg-[#A855F7] text-white font-bold text-sm tracking-wide transition-all shadow-[0_4px_16px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <span>{editingTag ? 'Update Tag' : 'Create Tag'}</span>
              )}
            </button>

            <button
              type="button"
              onClick={close}
              className="w-full py-2.5 text-center text-xs text-white/40 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
