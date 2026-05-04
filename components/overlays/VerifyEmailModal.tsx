"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Drawer,
  Typography,
  Button,
  Box,
  CircularProgress,
  Stack,
  Fade,
  alpha,
  useTheme,
  useMediaQuery
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  Mail as MailIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { completeEmailVerification } from "@/lib/appwrite";

interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VerifyEmailModal({ isOpen, onClose }: VerifyEmailModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const params = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error" | "missing"
  >("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    const userId = params.get("userId");
    const secret = params.get("secret");

    if (!userId || !secret) {
      setStatus("missing");
      setMessage("Verification link is missing required parameters.");
      return;
    }

    const run = async () => {
      setStatus("verifying");
      try {
        await completeEmailVerification(userId, secret);
        setStatus("success");
        setMessage("Email verified successfully.");
      } catch (e: unknown) {
        const err = e as { message?: string };
        setStatus("error");
        setMessage(
          err?.message ||
            "Verification failed. The link may have expired or was already used."
        );
      }
    };

    run();
  }, [isOpen, params]);

  const goToSettings = () => {
    onClose();
    router.replace("/settings");
  };
  
  const goHome = () => {
    onClose();
    router.replace("/");
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={isOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 450px)',
          maxWidth: '100%',
          height: isMobile ? '92dvh' : '100%',
          maxHeight: '100dvh',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', pt: 4, pb: 1, flexShrink: 0 }}>
        <Box sx={{ 
          display: 'inline-flex', 
          p: 1.5, 
          borderRadius: '16px', 
          bgcolor: alpha(
            status === 'success' ? '#6366F1' : 
            status === 'error' || status === 'missing' ? '#FF4D4D' : '#6366F1', 
            0.1
          ),
          color: status === 'success' ? '#6366F1' : 
                 status === 'error' || status === 'missing' ? '#FF4D4D' : '#6366F1',
          mb: 2
        }}>
          {status === 'verifying' && <CircularProgress size={32} color="inherit" />}
          {status === 'success' && <CheckCircleIcon sx={{ fontSize: 32 }} />}
          {(status === 'error' || status === 'missing') && <ErrorOutlineIcon sx={{ fontSize: 32 }} />}
          {status === 'idle' && <MailIcon sx={{ fontSize: 32 }} />}
        </Box>
        <Typography variant="h5" sx={{ 
          fontWeight: 900, 
          letterSpacing: '-0.03em',
          fontFamily: 'var(--font-space-grotesk)',
          color: 'white'
        }}>
          Verify Email
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ pb: 4, textAlign: 'center', flex: 1, overflowY: 'auto' }}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {status === "verifying" && (
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Verifying your email address, please wait...
            </Typography>
          )}

          {status === "missing" && (
            <Box>
              <Typography variant="body2" sx={{ color: '#FF4D4D', mb: 1, fontWeight: 600 }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block', mb: 3 }}>
                Please open the most recent verification email and try again.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                startIcon={<HomeIcon sx={{ fontSize: 18 }} />}
                onClick={goHome}
                sx={{
                  py: 1.5,
                  borderRadius: '14px',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                }}
              >
                Go Home
              </Button>
            </Box>
          )}

          {status === "success" && (
            <Box>
              <Typography variant="body2" sx={{ color: '#6366F1', mb: 1, fontWeight: 600 }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block', mb: 3 }}>
                You can now continue setting up MFA or using your account.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SettingsIcon sx={{ fontSize: 18 }} />}
                  onClick={goToSettings}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    bgcolor: '#6366F1',
                    color: '#000',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#00D1DA' }
                  }}
                >
                  Settings
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<HomeIcon sx={{ fontSize: 18 }} />}
                  onClick={goHome}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  Home
                </Button>
              </Stack>
            </Box>
          )}

          {status === "error" && (
            <Box>
              <Typography variant="body2" sx={{ color: '#FF4D4D', mb: 1, fontWeight: 600 }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block', mb: 3 }}>
                If the link expired, request a new verification email from Settings.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SettingsIcon sx={{ fontSize: 18 }} />}
                  onClick={goToSettings}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  Settings
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<HomeIcon sx={{ fontSize: 18 }} />}
                  onClick={goHome}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  Home
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
