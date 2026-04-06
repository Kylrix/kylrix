'use client';

import React, { useMemo, useRef, useState } from 'react';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [format, setFormat] = useState<DesignExportFormat>('png');

  const flyer = useMemo(() => getDesignFlyerBySlug(slug) || DESIGN_FLYERS[0], [slug]);
  const FlyerComponent = flyer.component;

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
        minHeight: '100vh',
        bgcolor: '#0A0908',
        color: 'white',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      <DesignToolbar
        title={flyer.title}
        subtitle="Designs live in code"
        selectedFormat={format}
        onFormatChange={setFormat}
        onExport={handleExport}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '380px 1fr' }, minHeight: 0 }}>
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
          sx={{
            minHeight: 0,
            overflow: 'auto',
            p: { xs: 2, md: 4 },
            background: 'radial-gradient(circle at top, rgba(236,72,153,0.08), transparent 34%), #0A0908',
          }}
        >
          <Box
            sx={{
              maxWidth: 1320,
              mx: 'auto',
              display: 'grid',
              gap: 3,
            }}
          >
            <Box sx={{ color: 'rgba(255,255,255,0.52)', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ letterSpacing: '0.2em' }}>
                /designs/{flyer.slug}
              </Typography>
              <Typography variant="caption" sx={{ letterSpacing: '0.2em' }}>
                {flyer.description}
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                minHeight: { xs: 'calc(100vh - 240px)', md: 'calc(100vh - 180px)' },
              }}
            >
              <Box
                sx={{
                  width: 'min(100%, 1140px)',
                  maxWidth: '100%',
                  transformOrigin: 'top center',
                  mx: 'auto',
                }}
              >
                <FlyerComponent ref={flyerRef} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
