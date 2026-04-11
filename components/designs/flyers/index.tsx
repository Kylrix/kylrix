import { Box, Typography, alpha } from '@mui/material';
import Logo from '@/components/Logo';
import HappyEasterFlyer from './HappyEasterFlyer';
import MuralFrameFlyer from './MuralFrameFlyer';
import type { DesignFlyerDefinition } from '../types';

const HappyEasterPreview = () => (
  <Box
    sx={{
      position: 'relative',
      height: 120,
      borderRadius: 4,
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #161412 0%, #0A0908 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      p: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/designs/easter-calvary.svg)',
        backgroundSize: 'cover',
        opacity: 0.3,
      }}
    />
    <Typography
      variant="caption"
      sx={{
        position: 'relative',
        color: '#6366F1',
        letterSpacing: '0.3em',
        fontWeight: 900,
        textTransform: 'uppercase',
      }}
    >
      He Is Risen
    </Typography>
  </Box>
);

export const DESIGN_FLYERS: DesignFlyerDefinition[] = [
  {
    slug: 'happy-easter',
    title: 'Happy Easter',
    subtitle: '',
    description: '',
    accent: '#6366F1',
    component: HappyEasterFlyer,
    preview: HappyEasterPreview,
  },
  {
    slug: 'mural-frame',
    title: 'Mural Frame',
    subtitle: 'Code-driven background scaffold',
    description: 'A reusable frame for building the chat mural in tiny code-generated layers.',
    accent: '#EC4899',
    component: MuralFrameFlyer,
    preview: () => (
      <Box
        sx={{
          position: 'relative',
          height: 120,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #161412 0%, #0A0908 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 16% 22%, rgba(255,255,255,0.08) 0 1px, transparent 1.4px),
              radial-gradient(circle at 74% 18%, rgba(255,255,255,0.06) 0 1px, transparent 1.2px),
              radial-gradient(circle at 46% 62%, rgba(255,255,255,0.05) 0 1px, transparent 1.2px)
            `,
            backgroundSize: '100px 100px, 120px 120px, 140px 140px',
            opacity: 0.8,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            px: 1.5,
            py: 0.7,
            borderRadius: '999px',
            border: '1px solid rgba(236,72,153,0.22)',
            bgcolor: alpha('#EC4899', 0.08),
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#EC4899',
              letterSpacing: '0.3em',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            Mural Frame
          </Typography>
        </Box>
      </Box>
    ),
  },
];

export const DESIGN_DEFAULT_SLUG = 'happy-easter';

export const getDesignFlyerBySlug = (slug: string) => DESIGN_FLYERS.find((flyer) => flyer.slug === slug) || null;
