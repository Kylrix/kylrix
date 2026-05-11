import { TOPBAR_LAYOUT } from '@/lib/sdk/design';

/**
 * MUI Drawer Modal backdrops default to full-viewport (z-index ~modal) and sit above the
 * fixed ecosystem topbar (often wrapped at z-index 1000). Clip the backdrop so the top
 * chrome stays clickable while dimming remains below the fold.
 */
export const TOPBAR_DRAWER_BACKDROP_SLOT = {
  backdrop: {
    sx: {
      top: `${TOPBAR_LAYOUT.height}px`,
    },
  },
} as const;
