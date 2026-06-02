'use client';

import { Box, alpha } from '@/lib/mui-tailwind/material';

export default function CalvaryScene() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Atmosphere & Light Source */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 50% 30%, ${alpha('#FDE68A', 0.15)} 0%, transparent 50%),
            radial-gradient(circle at 20% 20%, ${alpha('#EC4899', 0.08)} 0%, transparent 40%)
          `,
          filter: 'blur(40px)',
        }}
      />

      {/* The Tomb (Bottom Right) */}
      <Box
        sx={{
          position: 'absolute',
          right: '-5%',
          bottom: '10%',
          width: '50%',
          height: '45%',
          background: `
            linear-gradient(145deg, #1C1917 0%, #0C0A09 100%)
          `,
          borderRadius: '60% 40% 0 0 / 100% 100% 0 0',
          boxShadow: `
            inset -20px -20px 60px rgba(0,0,0,0.8),
            0 30px 60px rgba(0,0,0,0.6)
          `,
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Tomb Opening */}
        <Box
          sx={{
            position: 'absolute',
            left: '15%',
            bottom: 0,
            width: '60%',
            height: '85%',
            background: 'linear-gradient(to top, #000 0%, #0C0A09 100%)',
            borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
            boxShadow: 'inset 0 10px 40px rgba(0,0,0,1)',
          }}
        />
        {/* Stone Texture Details */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.15,
            backgroundImage: `radial-gradient(#fff 1px, transparent 0)`,
            backgroundSize: '4px 4px',
            maskImage: 'linear-gradient(to right, black, transparent)',
          }}
        />
      </Box>

      {/* The Cross (Centered) */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 600,
          zIndex: 2,
        }}
      >
        {/* Vertical Beam */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '5%',
            transform: 'translateX(-50%)',
            width: 48,
            height: '95%',
            background: `
              linear-gradient(90deg, #2D241E 0%, #45372E 20%, #2D241E 50%, #1A1512 100%)
            `,
            borderRadius: 1,
            boxShadow: '10px 20px 40px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.03)',
            '&::after': { // Wood Grain
              content: '""',
              position: 'absolute',
              inset: 0,
              opacity: 0.2,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            }
          }}
        />

        {/* Horizontal Beam */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '28%',
            transform: 'translate(-50%, -50%)',
            width: 340,
            height: 44,
            background: `
              linear-gradient(180deg, #3B2F27 0%, #45372E 30%, #2D241E 70%, #1A1512 100%)
            `,
            borderRadius: 1,
            boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.03)',
            zIndex: 3,
          }}
        />

        {/* The Draped Cloth (Pure CSS Folds) */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '28%',
            transform: 'translate(-50%, -45%)',
            width: 300,
            height: 380,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        >
          {/* Main Drape - Left Side */}
          <Box
            sx={{
              position: 'absolute',
              left: '15%',
              top: '5%',
              width: 80,
              height: 300,
              background: `linear-gradient(165deg, ${alpha('#fff', 0.95)} 0%, ${alpha('#E5E7EB', 0.85)} 40%, ${alpha('#9CA3AF', 0.4)} 100%)`,
              clipPath: 'polygon(0% 0%, 100% 10%, 80% 100%, 20% 95%)',
              filter: 'drop-shadow(5px 5px 15px rgba(0,0,0,0.3))',
              transform: 'rotate(-5deg)',
            }}
          />
          {/* Main Drape - Right Side */}
          <Box
            sx={{
              position: 'absolute',
              right: '15%',
              top: '5%',
              width: 85,
              height: 320,
              background: `linear-gradient(-165deg, ${alpha('#fff', 0.92)} 0%, ${alpha('#E5E7EB', 0.88)} 35%, ${alpha('#9CA3AF', 0.45)} 100%)`,
              clipPath: 'polygon(100% 0%, 0% 12%, 15% 100%, 85% 92%)',
              filter: 'drop-shadow(-5px 5px 15px rgba(0,0,0,0.3))',
              transform: 'rotate(4deg)',
            }}
          />
          {/* Center Fold (Over the beam) */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: 120,
              height: 60,
              background: `linear-gradient(to bottom, #fff, #D1D5DB)`,
              borderRadius: '40% 40% 60% 60%',
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            }}
          />
        </Box>

        {/* The Nails (Subtle Metallic Glint) */}
        {[
          { left: '15%', top: '28%' }, // Left hand
          { right: '15%', top: '28%' }, // Right hand
          { left: '50%', bottom: '15%' }, // Feet
        ].map((pos, idx) => (
          <Box
            key={idx}
            sx={{
              position: 'absolute',
              ...pos,
              transform: 'translate(-50%, -50%)',
              width: 10,
              height: 10,
              background: 'radial-gradient(circle at 30% 30%, #94A3B8, #1E293B)',
              borderRadius: '20%',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              zIndex: 5,
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: -2,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'inherit',
              }
            }}
          />
        ))}
      </Box>

      {/* Ground & Shadows */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '25%',
          background: 'linear-gradient(to top, #0A0908 0%, transparent 100%)',
          zIndex: 3,
        }}
      />
      
      {/* Dynamic Lighting Highlights */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.03) 0%, transparent 60%)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}
