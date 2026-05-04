"use client";

import { useState, useEffect } from "react";
import { useFinalizeAuth } from "@/lib/finalizeAuth";
import {
  Drawer,
  Typography,
  Button,
  TextField, 
  Box, 
  CircularProgress, 
  Stack, 
  Fade, 
  alpha,
  useTheme,
  useMediaQuery,
} from "@mui/material";import {
  Smartphone as SmartphoneIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  VpnKey as KeyIcon,
  ChevronLeft as ChevronLeftIcon,
  VerifiedUser as ShieldCheckIcon,
} from "@mui/icons-material";
import {
  listMfaFactors,
  createMfaChallenge,
  completeMfaChallenge,
} from "@/lib/appwrite";
import toast from "react-hot-toast";

interface TwoFAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TwoFAModal({ isOpen, onClose }: TwoFAModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [factors, setFactors] = useState<{
    totp: boolean;
    email: boolean;
    phone: boolean;
  } | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<
    "totp" | "email" | "phone" | "recoverycode" | null
  >(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFactors();
    }
  }, [isOpen]);

  const loadFactors = async () => {
    try {
      const mfaFactors = await listMfaFactors();
      setFactors(mfaFactors);

      // Auto-select the first available factor
      if (mfaFactors.totp) setSelectedFactor("totp");
      else if (mfaFactors.email) setSelectedFactor("email");
      else if (mfaFactors.phone) setSelectedFactor("phone");
    } catch {
      toast.error("Failed to load authentication factors");
    }
  };

  const handleCreateChallenge = async (
    factor: "totp" | "email" | "phone" | "recoverycode",
  ) => {
    setLoading(true);
    try {
      const challenge = await createMfaChallenge(factor);
      setChallengeId(challenge.$id);
      setSelectedFactor(factor);
    } catch (_e: unknown) {
      const err = _e as { message?: string };
      toast.error(err.message || "Failed to create challenge");
    }
    setLoading(false);
  };

  const { finalizeAuth } = useFinalizeAuth();

  const handleCompleteChallenge = async () => {
    if (!challengeId || !code) return;

    setLoading(true);
    try {
      await completeMfaChallenge(challengeId, code);
      onClose();
      await finalizeAuth({ redirect: true, fallback: "/dashboard" });
    } catch (_e: unknown) {
      const err = _e as { message?: string };
      toast.error(err.message || "Invalid code");
    }
    setLoading(false);
  };

  const resetChallenge = () => {
    setChallengeId(null);
    setCode("");
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 400px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          borderRadius: isMobile ? '28px 28px 0 0' : '0',
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ textAlign: 'center', pt: 4, pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Box sx={{ 
          display: 'inline-flex', 
          p: 1.5, 
          borderRadius: '16px', 
          bgcolor: alpha('#6366F1', 0.1),
          color: '#6366F1',
          mb: 2
        }}>
          <ShieldCheckIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" sx={{ 
          fontWeight: 900, 
          letterSpacing: '-0.03em',
          fontFamily: 'var(--font-space-grotesk)',
          color: 'white'
        }}>
          Two-Factor Authentication
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 1 }}>
          Additional verification required to access your vault
        </Typography>
      </Box>

      <Box sx={{ pb: 4, px: 3, pt: 3, flex: 1, overflowY: 'auto' }}>
        {!factors ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: '#6366F1' }} />
          </Box>
        ) : !challengeId ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Choose Verification Method
            </Typography>

            {factors.totp && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SmartphoneIcon sx={{ fontSize: 20 }} />}
                onClick={() => handleCreateChallenge("totp")}
                disabled={loading}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderRadius: '14px',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&:hover': {
                    borderColor: '#6366F1',
                    bgcolor: alpha('#6366F1', 0.05)
                  }
                }}
              >
                Authenticator App
              </Button>
            )}

            {factors.email && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<MailIcon sx={{ fontSize: 20 }} />}
                onClick={() => handleCreateChallenge("email")}
                disabled={loading}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderRadius: '14px',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&:hover': {
                    borderColor: '#6366F1',
                    bgcolor: alpha('#6366F1', 0.05)
                  }
                }}
              >
                Email Code
              </Button>
            )}

            {factors.phone && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PhoneIcon sx={{ fontSize: 20 }} />}
                onClick={() => handleCreateChallenge("phone")}
                disabled={loading}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderRadius: '14px',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&:hover': {
                    borderColor: '#6366F1',
                    bgcolor: alpha('#6366F1', 0.05)
                  }
                }}
              >
                SMS Code
              </Button>
            )}

            <Box sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => setShowRecovery(!showRecovery)}
                sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}
              >
                {showRecovery ? "Hide recovery options" : "Use recovery code instead"}
              </Button>

              {showRecovery && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<KeyIcon sx={{ fontSize: 20 }} />}
                  onClick={() => handleCreateChallenge("recoverycode")}
                  disabled={loading}
                  sx={{
                    mt: 1,
                    justifyContent: 'flex-start',
                    py: 1.5,
                    px: 2,
                    borderRadius: '14px',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': {
                      borderColor: '#6366F1',
                      bgcolor: alpha('#6366F1', 0.05)
                    }
                  }}
                >
                  Recovery Code
                </Button>
              )}
            </Box>
          </Stack>
        ) : (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                {selectedFactor === "totp" && "Enter the 6-digit code from your authenticator app:"}
                {selectedFactor === "email" && "Enter the verification code sent to your email:"}
                {selectedFactor === "phone" && "Enter the verification code sent to your phone:"}
                {selectedFactor === "recoverycode" && "Enter your 10-character recovery code:"}
              </Typography>
              
              <TextField
                fullWidth
                autoFocus
                placeholder={selectedFactor === "recoverycode" ? "XXXXX-XXXXX" : "000000"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputProps={{ 
                  maxLength: selectedFactor === "recoverycode" ? 11 : 6,
                  style: { 
                    textAlign: 'center', 
                    fontSize: '1.5rem', 
                    letterSpacing: '0.2em',
                    fontFamily: 'monospace'
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                  },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={handleCompleteChallenge}
              disabled={loading || !code}
              sx={{
                py: 1.5,
                borderRadius: '14px',
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 700,
                '&:hover': {
                  bgcolor: '#00D1DA',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)'
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(99, 102, 241, 0.1)',
                  color: 'rgba(0, 0, 0, 0.3)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Verify & Continue"}
            </Button>

            <Button
              fullWidth
              variant="text"
              startIcon={<ChevronLeftIcon sx={{ fontSize: 18 }} />}
              onClick={resetChallenge}
              sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}
            >
              Choose different method
            </Button>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
