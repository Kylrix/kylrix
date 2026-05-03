'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  Divider,
  alpha,
} from '@mui/material';
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
  const planDuration = months === 1 ? '1 Month' : `${months} Months`;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          background: 'linear-gradient(180deg, #1F1D1B 0%, #161412 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      <Box sx={{ p: { xs: 3, sm: 4 }, maxWidth: '100%' }}>
        {/* Header with plan summary */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 4,
            pb: 3,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#6366F1',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                mb: 0.5,
              }}
            >
              Select Payment Method
            </Typography>
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 900,
                fontFamily: 'Clash Display',
              }}
            >
              Secure Checkout
            </Typography>
          </Box>

          {/* Plan summary on top right */}
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                opacity: 0.5,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.5,
              }}
            >
              Selected Plan
            </Typography>
            <Typography
              sx={{
                fontSize: '1rem',
                fontWeight: 900,
                fontFamily: 'Clash Display',
                color: '#6366F1',
                mb: 0.5,
              }}
            >
              {planDuration} Pro
            </Typography>
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 800,
                fontFamily: 'JetBrains Mono',
              }}
            >
              ${totalPrice.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* Payment options */}
        <Stack spacing={3}>
          {/* Kylrix Wallet Option */}
          <Button
            onClick={() => {
              onPaymentMethodSelect('kylrix');
              onClose();
            }}
            fullWidth
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '2px solid rgba(99, 102, 241, 0.3)',
              background: alpha('#6366F1', 0.06),
              textAlign: 'left',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                borderColor: '#6366F1',
                background: alpha('#6366F1', 0.12),
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha('#6366F1', 0.15)}`,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                transition: 'left 0.5s ease',
              },
              '&:hover::before': {
                left: '100%',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                justifyContent: 'space-between',
              }}
            >
              {/* Logo with wallet icon overlay */}
              <Box sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                  <Logo size={80} variant="icon" />
                </Box>
                {/* Wallet icon overlay at bottom-right */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    width: 36,
                    height: 36,
                    borderRadius: '12px',
                    background: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #161412',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  <Wallet size={18} color="white" />
                </Box>
              </Box>

              {/* Option details */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: '1rem',
                    fontWeight: 900,
                    fontFamily: 'Clash Display',
                    color: 'white',
                    mb: 0.5,
                  }}
                >
                  Proceed with: Kylrix Wallet
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    opacity: 0.6,
                    fontFamily: 'Satoshi',
                  }}
                >
                  Pay seamlessly using your Kylrix ecosystem wallet
                </Typography>
              </Box>

              {/* Arrow indicator */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: '#6366F1',
                  opacity: 0.8,
                  transition: 'opacity 0.3s',
                  '.MuiButtonBase-root:hover &': {
                    opacity: 1,
                  },
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Box>
            </Box>
          </Button>

          {/* External Wallet Option */}
          <Button
            onClick={() => {
              onPaymentMethodSelect('external');
              onClose();
            }}
            fullWidth
            sx={{
              p: 3,
              borderRadius: '20px',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              background: alpha('#FFFFFF', 0.02),
              textAlign: 'left',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
                background: alpha('#FFFFFF', 0.05),
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                transition: 'left 0.5s ease',
              },
              '&:hover::before': {
                left: '100%',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                justifyContent: 'space-between',
              }}
            >
              {/* Icon container */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(255, 255, 255, 0.05))',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  flexShrink: 0,
                }}
              >
                <Zap size={40} color="rgba(255, 255, 255, 0.5)" />
              </Box>

              {/* Option details */}
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: '1rem',
                    fontWeight: 900,
                    fontFamily: 'Clash Display',
                    color: 'white',
                    mb: 0.5,
                  }}
                >
                  Proceed with: External Wallet
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    opacity: 0.5,
                    fontFamily: 'Satoshi',
                    mb: 1,
                  }}
                >
                  Use any Web3 wallet to complete your purchase
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  {['MetaMask', 'Trust Wallet', 'WalletConnect'].map((wallet) => (
                    <Typography
                      key={wallet}
                      sx={{
                        fontSize: '0.7rem',
                        opacity: 0.4,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {wallet}
                    </Typography>
                  ))}
                </Box>
              </Box>

              {/* Arrow indicator */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  opacity: 0.6,
                  transition: 'opacity 0.3s',
                  '.MuiButtonBase-root:hover &': {
                    opacity: 1,
                  },
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Box>
            </Box>
          </Button>
        </Stack>

        {/* Footer note */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8rem',
              opacity: 0.4,
              fontFamily: 'Satoshi',
            }}
          >
            Your payment is secure and encrypted. You can always change your payment method in settings.
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default PaymentMethodDrawer;
