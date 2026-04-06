'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Drawer, IconButton, Stack, useMediaQuery, useTheme, Typography } from '@mui/material';
import { Menu, X } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import Logo from '@/components/Logo';
import DesignSidebar from './DesignSidebar';
import DesignToolbar from './DesignToolbar';
import { DESIGN_FLYERS, getDesignFlyerBySlug, DESIGN_DEFAULT_SLUG } from './flyers';
import type { DesignExportFormat } from './types';

interface DesignStudioProps {
  slug?: string;
}

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default function DesignStudio({ slug = DESIGN_DEFAULT_SLUG }: DesignStudioProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const flyerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [format, setFormat] = useState<DesignExportFormat>('png');
  const [zoom, setZoom] = useState(0.8);

  const flyer = useMemo(() => getDesignFlyerBySlug(slug) || DESIGN_FLYERS[0], [slug]);
  const FlyerComponent = flyer.component;

  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    if (containerWidth === 0 || containerHeight === 0) return;

    // FlyerShell has aspectRatio: 4/5. We target 1080px height as our base.
    const flyerWidth = 864; 
    const flyerHeight = 1080;

    const padding = isMobile ? 32 : 80;
    const scaleX = (containerWidth - padding) / flyerWidth;
    const scaleY = (containerHeight - padding) / flyerHeight;

    const newZoom = Math.min(scaleX, scaleY);
    // Limit auto-zoom to 1.0 to avoid pixelation, unless container is huge
    const clampedZoom = Math.min(newZoom, 1.2);
    setZoom(Number(clampedZoom.toFixed(2)));
  }, [isMobile]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      handleAutoFit();
    });

    observer.observe(containerRef.current);
    
    // Initial call
    handleAutoFit();

    return () => observer.disconnect();
  }, [handleAutoFit, slug]);

  const handleExport = async () => {
    const node = flyerRef.current;
    if (!node) {
      window.alert('Flyer canvas is not ready yet.');
      return;
    }

    try {
      const fileBase = `kylrix-${flyer.slug}`;
      const dataUrl =
        format === 'svg'
          ? await toSvg(node, { cacheBust: true, backgroundColor: '#0A0908' })
          : await toPng(node, {
              cacheBust: true,
              pixelRatio: 2,
              backgroundColor: '#0A0908',
            });

      downloadDataUrl(dataUrl, `${fileBase}.${format}`);
    } catch (error) {
      console.error('[DesignStudio] Export failed', error);
      window.alert('Export failed');
    }
  };

  return (
    <Box
      component="main"
      sx={{
        height: '100vh',
        bgcolor: '#0A0908',
        color: 'white',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        overflow: 'hidden',
      }}
    >
      <DesignToolbar
        title={flyer.title}
        subtitle="Designs live in code"
        selectedFormat={format}
        onFormatChange={setFormat}
        onExport={handleExport}
        zoom={zoom}
        onZoomChange={setZoom}
        onAutoFit={handleAutoFit}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '380px 1fr' }, height: '100%', minHeight: 0 }}>
        {isMobile ? (
          <>
            <Drawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              PaperProps={{ sx: { width: 'min(100%, 380px)', bgcolor: '#0A0908' } }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Logo app="root" variant="full" size={32} />
                <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: 'white' }}>
                  <X size={18} />
                </IconButton>
              </Box>
              <DesignSidebar onClose={() => setDrawerOpen(false)} />
            </Drawer>

            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Logo app="root" variant="icon" size={28} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Designs
                  </Typography>
                </Box>
                <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: 'white' }}>
                  <Menu size={18} />
                </IconButton>
              </Stack>
            </Box>
          </>
        ) : (
          <DesignSidebar />
        )}

        <Box
          ref={containerRef}
          sx={{
            height: '100%',
            overflow: 'auto',
            p: { xs: 2, md: 4 },
            background: 'radial-gradient(circle at top, rgba(236,72,153,0.08), transparent 34%), #0A0908',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 1320,
              mx: 'auto',
              flexShrink: 0,
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              color: 'rgba(255,255,255,0.52)',
            }}
          >
            <Typography variant="caption" sx={{ letterSpacing: '0.2em' }}>
              /designs/{flyer.slug}
            </Typography>
            <Typography variant="caption" sx={{ letterSpacing: '0.2em' }}>
              {flyer.description}
            </Typography>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
            }}
          >
            <Box
              sx={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Box sx={{ width: 864, height: 1080 }}>
                <FlyerComponent ref={flyerRef} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
