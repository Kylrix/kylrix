'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Drawer, Fab, IconButton, Menu, MenuItem, Paper, Stack, useMediaQuery, useTheme, Typography } from '@mui/material';
import { Download, LayoutList, Maximize, Menu as MenuIcon, MoveHorizontal, X, Home, ZoomIn, ZoomOut } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import Logo from '@/components/Logo';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const flyerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [format, setFormat] = useState<DesignExportFormat>('png');
  const [zoom, setZoom] = useState(0.8);
  const [zoomMode, setZoomMode] = useState<'fit' | 'max' | 'min'>('fit');
  const [formatMenuAnchor, setFormatMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(slug);

  useEffect(() => {
    const rawSlug = searchParams?.get('design') || slug || DESIGN_DEFAULT_SLUG;
    const nextSlug = getDesignFlyerBySlug(rawSlug)?.slug || DESIGN_DEFAULT_SLUG;
    setSelectedSlug((current) => (current === nextSlug ? current : nextSlug));
  }, [searchParams, slug]);

  const flyer = useMemo(() => getDesignFlyerBySlug(selectedSlug) || DESIGN_FLYERS[0], [selectedSlug]);
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
    setZoomMode('fit');
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
  }, [handleAutoFit, selectedSlug]);

  const handleExport = async () => {
    const node = flyerRef.current;
    if (!node) {
      window.alert('Flyer canvas is not ready yet.');
      return;
    }

    try {
      // Ensure all fonts are loaded before exporting to prevent fallback fonts in output
      if (typeof document !== 'undefined' && 'fonts' in document) {
        await (document as any).fonts.ready;
      }

      const fileBase = `kylrix-${flyer.slug}`;
      const exportOptions = {
        cacheBust: true,
        backgroundColor: '#242220', // Updated to much less deep brand brown
        pixelRatio: 2,
        skipFonts: false,
        // Letting html-to-image automatically find fonts now that crossOrigin is fixed
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '864px',
          height: '1080px',
        },
      };

      console.log('[DesignStudio] Starting high-fidelity export...');

      const dataUrl =
        format === 'svg'
          ? await toSvg(node, exportOptions)
          : await toPng(node, exportOptions);

      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Generated image is empty');
      }

      downloadDataUrl(dataUrl, `${fileBase}.${format}`);
    } catch (error: any) {
      // Better error logging for empty-looking objects
      const errorMessage = error?.message || error?.name || 'Unknown Error';
      const errorStack = error?.stack || 'No stack trace';
      
      console.error('[DesignStudio] Export failed:', {
        message: errorMessage,
        stack: errorStack,
        original: error,
      });

      if (errorMessage.includes('cssRules') || errorMessage.includes('SecurityError')) {
        window.alert('Export blocked by browser security. Try disabling extensions or using a different browser.');
      } else {
        window.alert(`Export failed: ${errorMessage}`);
      }
    }
  };

  const handleCycleZoom = () => {
    if (zoomMode === 'fit') {
      setZoom(1.2);
      setZoomMode('max');
      return;
    }

    if (zoomMode === 'max') {
      setZoom(0.55);
      setZoomMode('min');
      return;
    }

    handleAutoFit();
  };

  const handleMobileHome = () => {
    handleSelectFlyer(DESIGN_DEFAULT_SLUG);
  };

  const handleOpenLibrary = () => setDrawerOpen(true);

  const handleFormatSelect = (nextFormat: DesignExportFormat) => {
    setFormat(nextFormat);
    setFormatMenuAnchor(null);
  };

  const handleSelectFlyer = useCallback((nextSlug: string) => {
    const validSlug = getDesignFlyerBySlug(nextSlug)?.slug || DESIGN_DEFAULT_SLUG;
    setSelectedSlug(validSlug);
    router.replace(`/designs?design=${validSlug}`, { scroll: false });
  }, [router]);

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
      {isMobile ? (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            bgcolor: 'rgba(10,9,8,0.92)',
            backdropFilter: 'blur(18px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            position: 'relative',
            zIndex: 20,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {flyer.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.46)', letterSpacing: '0.16em' }}>
              {flyer.subtitle || 'Designs live in code'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton onClick={() => void handleExport()} sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.04)' }}>
              <Download size={16} />
            </IconButton>
            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.04)' }}>
              <MenuIcon size={16} />
            </IconButton>
          </Stack>
        </Box>
      ) : (
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
      )}

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
              <DesignSidebar selectedSlug={selectedSlug} onSelect={handleSelectFlyer} onClose={() => setDrawerOpen(false)} />
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
          <DesignSidebar selectedSlug={selectedSlug} onSelect={handleSelectFlyer} />
        )}

        <Box
          ref={containerRef}
          sx={{
            height: '100%',
            overflow: 'auto',
            p: { xs: 2, md: 4 },
            pb: { xs: 'calc(92px + env(safe-area-inset-bottom))', md: 4 },
            background: 'radial-gradient(circle at top, rgba(236,72,153,0.08), transparent 34%), #0A0908',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
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

        {isMobile && (
          <>
            <Paper
              elevation={0}
              sx={{
                position: 'fixed',
                left: 12,
                right: 12,
                bottom: 12,
                zIndex: 30,
                borderRadius: '22px',
                bgcolor: 'rgba(10,9,8,0.92)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 14px 40px rgba(0,0,0,0.48)',
                p: 1,
                pb: 'calc(8px + env(safe-area-inset-bottom))',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <IconButton
                  onClick={handleMobileHome}
                  sx={{
                    color: 'white',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Home size={16} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Home
                  </Typography>
                </IconButton>

                <IconButton
                  onClick={handleOpenLibrary}
                  sx={{
                    color: 'white',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <LayoutList size={16} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Lists
                  </Typography>
                </IconButton>

                <IconButton
                  onClick={(event) => setFormatMenuAnchor(event.currentTarget)}
                  sx={{
                    color: 'white',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <MoveHorizontal size={16} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {format.toUpperCase()}
                  </Typography>
                </IconButton>

                <IconButton
                  onClick={() => void handleExport()}
                  sx={{
                    color: 'white',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: '#EC4899',
                  }}
                >
                  <Download size={16} />
                  <Typography sx={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Export
                  </Typography>
                </IconButton>
              </Stack>
            </Paper>

            <Fab
              onClick={handleCycleZoom}
              sx={{
                position: 'fixed',
                right: 16,
                bottom: 92,
                zIndex: 31,
                bgcolor: '#161412',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
                '&:hover': { bgcolor: '#1c1a18' },
              }}
            >
              <Stack alignItems="center" spacing={0}>
                {zoomMode === 'fit' ? <Maximize size={18} /> : zoomMode === 'max' ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
                <Typography sx={{ fontSize: 9, fontWeight: 900, lineHeight: 1, letterSpacing: '0.12em' }}>
                  {zoomMode === 'fit' ? 'MAX' : zoomMode === 'max' ? 'MIN' : 'FIT'}
                </Typography>
              </Stack>
            </Fab>
          </>
        )}
      </Box>

      <Menu
        anchorEl={formatMenuAnchor}
        open={Boolean(formatMenuAnchor)}
        onClose={() => setFormatMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: 'rgba(15,15,15,0.96)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 160,
          },
        }}
      >
        <MenuItem selected={format === 'png'} onClick={() => handleFormatSelect('png')}>PNG</MenuItem>
        <MenuItem selected={format === 'svg'} onClick={() => handleFormatSelect('svg')}>SVG</MenuItem>
      </Menu>
    </Box>
  );
}
