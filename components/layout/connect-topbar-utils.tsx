'use client';

import { Box, Typography } from '@/lib/openbricks/primitives';

export interface PageMatch {
  text: string;
  tag: string;
  element: HTMLElement;
}

export const SYSTEM_SHORTCUTS = [
  { key: 'Ctrl + F', desc: 'Search ecosystem' },
  { key: 'Ctrl + K', desc: 'Open Kylie assistant' },
  { key: 'Ctrl + S', desc: 'Ecosystem apps directory' },
  { key: 'Ctrl + M', desc: 'Profile system panel' },
  { key: 'Ctrl + P', desc: 'Navigate to workspaces' },
  { key: 'Ctrl + N', desc: 'Navigate to ideas' },
  { key: 'Ctrl + T', desc: 'Navigate to tags' },
  { key: 'Ctrl + X', desc: 'Navigate to settings' },
  { key: 'Ctrl + Shift + V', desc: 'Navigate to vault' },
  { key: 'Ctrl + G', desc: 'Navigate to goals' },
  { key: 'Ctrl + Q', desc: 'Navigate to forms' },
  { key: 'Ctrl + E', desc: 'Navigate to events' },
  { key: 'Ctrl + H', desc: 'Navigate to calls / huddles' },
  { key: 'Ctrl + /', desc: 'Full keyboard shortcuts reference' },
] as const;

export function renderShortcutsList() {
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {SYSTEM_SHORTCUTS.map((item) => (
        <Box
          key={item.key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1.5,
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.04)'}}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)', lineHeight: 1.35, minWidth: 0 }}>
            {item.desc}
          </Typography>
          <Typography
            component="span"
            sx={{
              color: '#6366F1',
              fontSize: '0.72rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              bgcolor: 'rgba(99, 102, 241, 0.08)',
              px: 1.1,
              py: 0.55,
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.18)',
              flexShrink: 0,
              whiteSpace: 'nowrap'}}
          >
            {item.key}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function searchOnPage(query: string): PageMatch[] {
  if (typeof window === 'undefined' || !query) return [];
  const lowercaseQuery = query.toLowerCase();
  const matches: PageMatch[] = [];
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA', 'BUTTON', 'HEADER', 'NAV'];
        if (skipTags.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        
        if (
          parent.closest('.kylrix-topbar') || 
          parent.closest('[data-note-search-surface]') || 
          parent.closest('.ob-drawer-root')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    const text = currentNode.nodeValue?.trim();
    if (text && text.toLowerCase().includes(lowercaseQuery) && text.length < 200) {
      const parent = currentNode.parentElement;
      if (parent) {
        if (!matches.some(m => m.element === parent)) {
          matches.push({
            text,
            tag: parent.tagName.toLowerCase(),
            element: parent
          });
        }
      }
    }
    if (matches.length >= 8) break;
    currentNode = walker.nextNode();
  }
  
  return matches;
}

export function highlightElement(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  const originalTransition = el.style.transition;
  const originalOutline = el.style.outline;
  const originalBoxShadow = el.style.boxShadow;
  
  el.style.transition = 'all 0.3s ease';
  el.style.outline = '2px solid #6366F1';
  el.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.6)';
  el.style.borderRadius = '4px';
  
  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.boxShadow = originalBoxShadow;
    setTimeout(() => {
      el.style.transition = originalTransition;
    }, 300);
  }, 2000);
}

export const BRAND_INDIGO = '#6366F1';

