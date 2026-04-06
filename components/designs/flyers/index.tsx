import { Box, Typography, alpha } from '@mui/material';
import Logo from '@/components/Logo';
import HappyEasterFlyer from './HappyEasterFlyer';
import type { DesignFlyerDefinition } from '../types';

const HappyEasterPreview = () => (
  <Box
    sx={{
      position: 'relative',
      height: 170,
      borderRadius: 4,
      overflow: 'hidden',
      background:
        'radial-gradient(circle at 20% 20%, rgba(236,72,153,0.34) 0%, transparent 35%), linear-gradient(160deg, #241214 0%, #120f0d 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      p: 2,
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
      <Box>
        <Typography variant="caption" sx={{ color: '#F9A8D4', letterSpacing: '0.18em', fontWeight: 900 }}>
          HAPPY EASTER
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 0.5, fontWeight: 800, maxWidth: 120 }}>
          Seasonal flyer with 3D glow.
        </Typography>
      </Box>
      <Logo app="note" variant="icon" size={36} />
    </Box>
    <Box
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 70,
        height: 104,
        borderRadius: '50% 50% 44% 44%',
        bgcolor: alpha('#fff', 0.18),
        border: '1px solid rgba(255,255,255,0.15)',
        transform: 'rotate(14deg)',
      }}
    />
    <Box
      sx={{
        position: 'absolute',
        left: 18,
        bottom: 18,
        width: 96,
        height: 96,
        borderRadius: '999px',
        bgcolor: alpha('#F59E0B', 0.16),
        filter: 'blur(10px)',
      }}
    />
  </Box>
);

export const DESIGN_FLYERS: DesignFlyerDefinition[] = [
  {
    slug: 'happy-easter',
    title: 'Happy Easter',
    subtitle: 'Seasonal flyer with 3D glow',
    description: 'A pastel, code-first Easter composition with live 3D accents and export-ready framing.',
    accent: '#EC4899',
    component: HappyEasterFlyer,
    preview: HappyEasterPreview,
  },
];

export const DESIGN_DEFAULT_SLUG = 'happy-easter';

export const getDesignFlyerBySlug = (slug: string) => DESIGN_FLYERS.find((flyer) => flyer.slug === slug) || null;
