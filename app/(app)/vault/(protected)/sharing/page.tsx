"use client";

import { useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  Paper, 
  IconButton, 
  Stack,
  alpha 
} from '@mui/material';
import { ArrowLeft, Share2, Lock } from 'lucide-react';

export default function SharingPage() {
  const router = useRouter();

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      pb: 10,
      bgcolor: '#0A0908',
      pt: { xs: 2, md: 4 }
    }}>
      {/* Header Section */}
      <Box sx={{ px: { xs: 2, md: 6 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
          <IconButton 
            onClick={() => router.back()} 
            sx={{ 
              color: '#fff', 
              bgcolor: '#161412',
              border: '1px solid #1C1A18',
              '&:hover': { bgcolor: '#1C1A18' }
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
            Sharing
          </Typography>
        </Stack>

        {/* Info / Coming Soon Section */}
        <Box sx={{ maxWidth: 600, mt: 4 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 6, 
              borderRadius: '32px', 
              bgcolor: '#161412', 
              border: '1px solid #1C1A18',
              backgroundImage: 'none',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3
            }}
          >
            {/* Animated / Beautiful Icon Container */}
            <Box 
              sx={{ 
                p: 3, 
                borderRadius: '24px', 
                bgcolor: alpha('#10B981', 0.05), 
                color: '#10B981', 
                border: '1px solid rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <Share2 size={36} strokeWidth={1.5} />
              <Box 
                sx={{ 
                  position: 'absolute', 
                  bottom: -4, 
                  right: -4, 
                  bgcolor: '#0A0908', 
                  borderRadius: '50%', 
                  p: 0.5,
                  border: '1px solid #1C1A18'
                }}
              >
                <Box 
                  sx={{ 
                    bgcolor: alpha('#10B981', 0.1), 
                    color: '#10B981',
                    borderRadius: '50%',
                    p: 0.5,
                    display: 'flex'
                  }}
                >
                  <Lock size={12} />
                </Box>
              </Box>
            </Box>

            <Stack spacing={1.5}>
              <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                Private Sharing
              </Typography>
              <Typography sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6 }}>
                We are building a highly secure way for you to share secrets with team members and trusted users. 
              </Typography>
              <Typography sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6 }}>
                Since your secrets never leave your device, this sharing mechanism is being built to maintain full privacy without ever exposing your keys to anyone else.
              </Typography>
            </Stack>

            <Box 
              sx={{ 
                mt: 2, 
                px: 3, 
                py: 1.5, 
                borderRadius: '16px', 
                bgcolor: alpha('#10B981', 0.03), 
                border: '1px solid rgba(16, 185, 129, 0.05)',
                width: '100%',
                maxWidth: 400
              }}
            >
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Protected by Design
              </Typography>
              <Typography variant="body2" sx={{ color: '#9B9691', mt: 0.5, fontWeight: 500 }}>
                Your private vault remains completely isolated and secure.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
