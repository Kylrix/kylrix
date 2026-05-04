'use client';

import { useState } from 'react';
import { account, functions } from '@/lib/appwrite';
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';

interface WalletManagerProps {
  userId: string;
  connectedWallet?: string;
  onWalletConnected?: (address: string) => void;
  onWalletDisconnected?: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function WalletManager({
  userId,
  connectedWallet,
  onWalletConnected,
  onWalletDisconnected,
}: WalletManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed. Please install MetaMask browser extension.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Request wallet connection
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No wallet account selected');
      }

      const walletAddress = accounts[0];

      // 2. Create message for user to sign
      const timestamp = Date.now();
      const baseMessage = `auth-${timestamp}`;
      const fullMessage = `Sign this message to authenticate: ${baseMessage}`;

      // 3. User signs the message in their wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [fullMessage, walletAddress],
      });

      // 4. Call connect-wallet endpoint for server verification
      const execution = await functions.createExecution(
        process.env.NEXT_PUBLIC_FUNCTION_ID!,
        JSON.stringify({
          userId,
          address: walletAddress,
          signature,
          message: baseMessage,
        }),
        false,
        '/connect-wallet'
      );

      const response = JSON.parse(execution.responseBody);

      if (execution.responseStatusCode !== 200) {
        throw new Error(response.error || 'Failed to connect wallet');
      }

      setSuccess(
        `✓ Wallet ${walletAddress.substring(0, 6)}...${walletAddress.substring(38)} connected successfully!`
      );

      if (onWalletConnected) {
        onWalletConnected(walletAddress);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWallet = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDisconnectConfirm(false);

    try {
      // Get current user
      const user = await account.get();

      // Remove wallet from prefs
      await account.updatePrefs({
        ...user.prefs,
        walletEth: undefined,
      });

      setSuccess('✓ Wallet disconnected successfully');

      if (onWalletDisconnected) {
        onWalletDisconnected();
      }
    } catch (err: any) {
      setError(err.message || 'Error disconnecting wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Wallet Status */}
      {connectedWallet && (
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            p: 3,
            mb: 3,
          }}
        >
          <Stack spacing={1}>
            <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)', mb: 0.5 }}>
              Connected Wallet Address
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: 'white', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {connectedWallet}
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Action Buttons */}
      <Stack spacing={2} direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
        {!connectedWallet ? (
          <Button
            onClick={handleConnectWallet}
            disabled={loading}
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <LinkIcon />}
            sx={{
              backgroundColor: '#6366F1',
              color: 'white',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '12px',
              px: 3,
              py: 1.2,
              '&:hover': { backgroundColor: '#4f46e5' },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        ) : (
          <Button
            onClick={() => setDisconnectConfirm(true)}
            disabled={loading}
            variant="outlined"
            sx={{
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              textTransform: 'none',
              borderRadius: '12px',
              px: 3,
              py: 1.2,
              '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            {loading ? 'Disconnecting...' : 'Disconnect Wallet'}
          </Button>
        )}
      </Stack>

      {/* Status Messages */}
      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: '12px' }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2, borderRadius: '12px' }}>
          <AlertTitle>Success</AlertTitle>
          {success}
        </Alert>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog 
        open={disconnectConfirm} 
        onClose={() => setDisconnectConfirm(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: '#0A0908',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none',
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', fontWeight: 800 }}>
          Disconnect Wallet
        </DialogTitle>
        <DialogContent sx={{ color: 'white', minWidth: { xs: '100%', sm: 400 } }}>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: '12px' }}>
            <AlertTitle>Confirm Disconnection</AlertTitle>
            Are you sure you want to disconnect your wallet? You can reconnect it anytime.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setDisconnectConfirm(false)}
            sx={{ color: 'rgba(255, 255, 255, 0.6)', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDisconnectWallet}
            variant="contained"
            sx={{
              backgroundColor: '#ef4444',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            Disconnect
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
