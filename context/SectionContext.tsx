'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Box, Divider, useTheme, useMediaQuery } from '@mui/material';
import { usePathname } from 'next/navigation';
import { recordAnonymizedTelemetry } from '@/lib/actions/client-ops';
import DesktopRightSection, { PanelType } from '@/components/layout/DesktopRightSection';

export interface SectionConfig {
  columnsCount: number; // 1, 2, 3, or 4 columns
  sections: Array<{
    id: string;
    type: 'original' | 'panel';
    width: string; // e.g. '1fr', '400px'
    panels?: PanelType[];
  }>;
}

interface SectionContextType {
  getLayoutForRoute: (route: string) => SectionConfig;
  updateRouteOverride: (route: string, override: Partial<SectionConfig>) => void;
  resetOverrides: () => void;
  screenWidth: number;
}

const SectionContext = createContext<SectionContextType | undefined>(undefined);

// Core default layouts for flagged routes in Kylrix
const DEFAULT_LAYOUTS: Record<string, PanelType[]> = {
  '/note/tags': ['note', 'huddles', 'projects'],
  '/note/shared': ['tags', 'huddles', 'projects'],
  '/flow/goals': ['forms', 'huddles', 'projects'],
  '/flow/forms': ['projects', 'huddles', 'goals'],
  '/flow/events': ['note', 'huddles', 'goals'],
  '/vault/dashboard': ['note', 'totp', 'projects'],
  '/vault/totp': ['secrets', 'secret_chat'],
  '/vault/sharing': ['secrets', 'totp', 'secret_chat'],
  '/connect/chats': ['note', 'huddles', 'projects'],
  '/connect/calls': ['projects', 'threads'],
};

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Record<string, Partial<SectionConfig>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kylrix:sections:overrides');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist overrides locally and conditionally dispatch 1% anonymous telemetry
  const updateRouteOverride = (route: string, override: Partial<SectionConfig>) => {
    setOverrides((prev) => {
      const updated = { ...prev, [route]: { ...prev[route], ...override } };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix:sections:overrides', JSON.stringify(updated));
        
        // 1% discretionary telemetry dispatch to optimize sections globally
        if (Math.random() < 0.01) {
          void recordAnonymizedTelemetry({
            niche: 'system',
            app: 'sections',
            action: 'layout_override',
            intent: 'optimize_columns',
            metadata: {
              route,
              screenWidth,
              columnsCount: override.columnsCount,
              overriddenAt: new Date().toISOString(),
            }
          }).catch(err => console.warn('[SectionProvider] Telemetry failed:', err));
        }
      }
      return updated;
    });
  };

  const resetOverrides = () => {
    setOverrides({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:sections:overrides');
    }
  };

  // Intelligent fallback: auto-partitions data/sections for non-configured routes
  const analyzeAndPartitionRoute = (route: string): PanelType[] => {
    const cleanRoute = route.split('?')[0];

    // /send page fallback: split composition, Sparks history, security Context
    if (cleanRoute.startsWith('/send')) {
      return ['note', 'secrets', 'huddles'];
    }

    // Default dynamic fallback
    if (cleanRoute.includes('settings')) {
      return ['totp'];
    }

    return ['note', 'projects'];
  };

  // Computes the dynamic layout depending on screen width and route preferences
  const getLayoutForRoute = (route: string): SectionConfig => {
    const cleanRoute = route.split('?')[0];
    const userOverride = overrides[cleanRoute];

    // Find predefined panels or fetch dynamic partition fallback
    const routePanels = DEFAULT_LAYOUTS[cleanRoute] || analyzeAndPartitionRoute(cleanRoute);

    // Dynamic Section breakdown according to screen real estate
    let columnsCount = 2;
    let sections: SectionConfig['sections'] = [];

    if (screenWidth < 1200) {
      // Mobile & Tablet: Standard single-column flow
      columnsCount = 1;
      sections = [{ id: 'original', type: 'original', width: '1fr' }];
    } else if (screenWidth >= 1200 && screenWidth < 1600) {
      // Laptop: Standard 2-column sidebar layout
      columnsCount = 2;
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'sidebar-1', type: 'panel', width: '400px', panels: routePanels },
      ];
    } else if (screenWidth >= 1600 && screenWidth < 2000) {
      // Ultra-Wide Desktop: 3-column screen partition
      columnsCount = 3;
      // Extract the first panel into its own column, keep rest in column 3
      const firstPanel = routePanels[0] ? [routePanels[0]] : [];
      const remainingPanels = routePanels.slice(1);
      
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'column-first', type: 'panel', width: '380px', panels: firstPanel },
        { id: 'column-rest', type: 'panel', width: '380px', panels: remainingPanels },
      ];
    } else {
      // Double Ultra-Wide: 4-column display setup
      columnsCount = Math.min(4, routePanels.length + 1);
      sections = [{ id: 'original', type: 'original', width: '1fr' }];
      
      // Auto-partition each panel to its own dedicated column
      routePanels.slice(0, 3).forEach((panel, index) => {
        sections.push({
          id: `column-dedicated-${index}`,
          type: 'panel',
          width: '360px',
          panels: [panel]
        });
      });
    }

    // Apply any active overrides
    const finalConfig = {
      columnsCount: userOverride?.columnsCount ?? columnsCount,
      sections: userOverride?.sections ?? sections,
    };

    return finalConfig;
  };

  const contextValue = useMemo<SectionContextType>(() => ({
    getLayoutForRoute,
    updateRouteOverride,
    resetOverrides,
    screenWidth,
  }), [screenWidth, overrides]);

  return (
    <SectionContext.Provider value={contextValue}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error('useSection must be used within a SectionProvider');
  }
  return context;
}

interface MultiSectionContainerProps {
  children: React.ReactNode;
  panels?: PanelType[];
  contextId?: string;
}

export function MultiSectionContainer({ children, panels, contextId }: MultiSectionContainerProps) {
  const pathname = usePathname();
  const { getLayoutForRoute } = useSection();
  const theme = useTheme();

  const layout = useMemo(() => {
    const calculated = getLayoutForRoute(pathname);
    // If explicit panels prop is passed, override computed panels in columns
    if (panels && calculated.columnsCount > 1) {
      if (calculated.columnsCount === 2) {
        calculated.sections[1].panels = panels;
      } else if (calculated.columnsCount === 3) {
        calculated.sections[1].panels = [panels[0]];
        calculated.sections[2].panels = panels.slice(1);
      } else if (calculated.columnsCount === 4) {
        calculated.sections[1].panels = [panels[0]];
        calculated.sections[2].panels = [panels[1]];
        if (calculated.sections[3]) {
          calculated.sections[3].panels = [panels[2]];
        }
      }
    }
    return calculated;
  }, [pathname, getLayoutForRoute, panels]);

  // Compute CSS Grid columns style
  const gridTemplateColumns = useMemo(() => {
    return layout.sections.map(s => s.width).join(' ');
  }, [layout]);

  if (layout.columnsCount === 1) {
    return <Box sx={{ width: '100%' }}>{children}</Box>;
  }

  return (
    <Box 
      sx={{ 
        display: 'grid', 
        gridTemplateColumns, 
        gap: 4, 
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        // Premium margin padding positioning sides of the screen
        px: { xs: 2, lg: 4, xl: 6 },
        boxSizing: 'border-box'
      }}
    >
      {layout.sections.map((section) => {
        if (section.type === 'original') {
          return (
            <Box key={section.id} sx={{ minWidth: 0, width: '100%' }}>
              {children}
            </Box>
          );
        }

        if (!section.panels || section.panels.length === 0) return null;

        return (
          <Box 
            key={section.id} 
            sx={{ 
              display: { xs: 'none', lg: 'block' },
              position: 'sticky',
              top: '108px',
              height: 'calc(100vh - 120px)',
              overflowY: 'hidden',
              width: section.width,
              minWidth: section.width,
              boxSizing: 'border-box'
            }}
          >
            <DesktopRightSection panels={section.panels} contextId={contextId} />
          </Box>
        );
      })}
    </Box>
  );
}
