'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  alpha,
  useTheme,
  useMediaQuery,
} from '@/lib/mui-tailwind/material';
import { Wallet, Zap } from 'lucide-react';
import Logo from './Logo';

interface PaymentMethodDrawerProps {
  open: boolean;
  onClose: () => void;
  months: number;
  totalPrice: number;
  onPaymentMethodSelect: (method: 'kylrix' | 'external') => void;
}

const PaymentMethodDrawer: React.FC<PaymentMethodDrawerProps> = ({
  open,
  onClose,
  months,
  totalPrice,
  onPaymentMethodSelect,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const planDuration = months === 1 ? '1 Month' : `${months} Months`;

  const drawerContent = (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: '1.25rem',
            mb: 0.5,
            color: 'white',
          }}
        >
          Payment Method
        </Typography>
        <Typography
          sx={{
            fontSize: '0.875rem',
            opacity: 0.5,
            mb: 2,
          }}
        >
          {planDuration} Pro • ${totalPrice.toFixed(2)}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {/* Kylrix Wallet */}
          <Button
            onClick={() => {
              onPaymentMethodSelect('kylrix');
              onClose();
            }}
            fullWidth
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '2px solid rgba(99, 102, 241, 0.3)',
              background: alpha('#6366F1', 0.06),
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#6366F1',
                background: alpha('#6366F1', 0.12),
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* Logo with wallet icon */}
            <Box sx={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
              <Logo size={40} variant="icon" />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -6,
                  right: -6,
                  width: 24,
                  height: 24,
                  borderRadius: '6px',
                  background: '#6366F1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #000000',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                }}
              >
                <Wallet size={12} color="white" />
              </Box>
            </Box>

            {/* Text */}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  color: 'white',
                  mb: 0.25,
                }}
              >
                Kylrix Wallet
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  opacity: 0.5,
                }}
              >
                Ecosystem wallet
              </Typography>
            </Box>

            {/* Arrow */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#6366F1', flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Button>

          {/* External Wallet */}
          <Button
            onClick={() => {
              onPaymentMethodSelect('external');
              onClose();
            }}
            fullWidth
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: alpha('#FFFFFF', 0.02),
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
                background: alpha('#FFFFFF', 0.05),
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Zap size={20} color="rgba(255, 255, 255, 0.4)" />
            </Box>

            {/* Text */}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  color: 'white',
                  mb: 0.25,
                }}
              >
                External Wallet
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  opacity: 0.4,
                }}
              >
                MetaMask, Trust Wallet, etc.
              </Typography>
            </Box>

            {/* Arrow */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.5, flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Button>
        </Stack>
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Typography
          sx={{
            fontSize: '0.75rem',
            opacity: 0.3,
            textAlign: 'center',
          }}
        >
          Your payment is encrypted and secure
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          background: 'linear-gradient(180deg, #1F1D1B 0%, #161412 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          width: '100%',
          maxHeight: isMobile ? '65vh' : '70vh',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default PaymentMethodDrawer;
