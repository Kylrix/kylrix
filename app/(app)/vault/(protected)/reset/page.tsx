"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  CircularProgress,
  alpha,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SecurityIcon from "@mui/icons-material/Security";
import { useAppwriteVault } from "@/context/appwrite-context";
import { resetMasterpassAndWipe } from "@/lib/appwrite";
import toast from "react-hot-toast";
import { SudoModal } from "@/components/overlays/SudoModal";

export default function MasterpassResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppwriteVault();
  const [step, setStep] = useState<"reset" | "confirm" | "done">("reset");
  const [loading, setLoading] = useState(false);
  const [isSudoOpen, setIsSudoOpen] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl");

  // Redirect to masterpass if not logged in
  useEffect(() => {
    if (user === null) {
      const target = callbackUrl 
        ? `/dashboard?callbackUrl=${encodeURIComponent(callbackUrl)}` 
        : "/dashboard";
      router.replace(target);
    }
  }, [user, router, callbackUrl]);

  const handleStartReset = () => {
    setIsSudoOpen(true);
  };

  const onSudoSuccess = () => {
    setIsSudoOpen(false);
    setStep("confirm");
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      if (user) {
        await resetMasterpassAndWipe(user.$id);
        // Wipe local storage keys that might be cached
        localStorage.removeItem(`passkey_skip_${user.$id}`);
        setStep("done");
      }
    } catch {
      toast.error("Failed to reset master password");
    }
    setLoading(false);
  };

  if (user === undefined) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user === null) {
    return null;
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: '#000',
      p: 4
    }}>
      <Paper sx={{
        width: '100%',
        maxWidth: '450px',
        borderRadius: '28px',
        bgcolor: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(25px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundImage: 'none',
        p: 4,
        textAlign: 'center'
      }}>
        <Box sx={{ 
          display: 'inline-flex', 
          p: 2, 
          borderRadius: '20px', 
          bgcolor: alpha(step === 'done' ? '#6366F1' : '#FF4D4D', 0.1),
          color: step === 'done' ? '#6366F1' : '#FF4D4D',
          mb: 3
        }}>
          {step === 'done' ? <CheckCircleIcon sx={{ fontSize: 40 }} /> : <SecurityIcon sx={{ fontSize: 40 }} />}
        </Box>

        <Typography variant="h4" sx={{ 
          fontWeight: 900, 
          letterSpacing: '-0.03em',
          fontFamily: 'var(--font-space-grotesk)',
          color: 'white',
          mb: 1
        }}>
          {step === 'reset' ? "Reset Master Password" : step === 'confirm' ? "Are you sure?" : "Vault Wiped"}
        </Typography>

        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 4 }}>
          {step === "reset"
            ? "This action is irreversible and will wipe all your encrypted data."
            : step === "confirm"
            ? "This is your last chance. Once confirmed, your data is gone forever."
            : "Your master password and all encrypted data have been successfully wiped."}
        </Typography>

        {step === "reset" && (
          <Stack spacing={2}>
            <Paper sx={{ 
              p: 2, 
              borderRadius: '16px', 
              bgcolor: alpha('#FF4D4D', 0.05), 
              border: '1px solid rgba(255, 77, 77, 0.2)',
              display: 'flex',
              gap: 2,
              alignItems: 'flex-start',
              textAlign: 'left'
            }}>
              <WarningAmberIcon sx={{ fontSize: 20, color: "#FF4D4D", flexShrink: 0, mt: '2px' }} />
              <Typography variant="caption" sx={{ color: '#FF4D4D', fontWeight: 500 }}>
                WARNING: This will permanently delete all your credentials, notes, and folders. This cannot be undone.
              </Typography>
            </Paper>

            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.8rem' }}>
              Verification with Passkey or PIN is required to continue.
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={handleStartReset}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                bgcolor: '#FF4D4D',
                color: 'white',
                fontWeight: 700,
                '&:hover': {
                  bgcolor: '#D32F2F',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(255, 77, 77, 0.3)'
                }
              }}
            >
              Verify Identity to Reset
            </Button>

            <Button
              fullWidth
              variant="text"
              startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
              onClick={() => router.back()}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
              }}
            >
              Cancel and Go Back
            </Button>
          </Stack>
        )}

        {step === "confirm" && (
          <Stack spacing={2}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#FF4D4D', 0.1), border: '1px solid #FF4D4D' }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
                I understand that resetting my master password will delete all my stored data permanently.
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={handleReset}
              disabled={loading}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                bgcolor: '#FF4D4D',
                color: 'white',
                fontWeight: 800,
                border: '2px solid white',
                '&:hover': {
                  bgcolor: '#D32F2F',
                  transform: 'scale(1.02)',
                  boxShadow: '0 0 30px rgba(255, 77, 77, 0.5)'
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "FINAL CONFIRMATION: WIPE EVERYTHING"}
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => setStep("reset")}
              disabled={loading}
              sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              Wait, take me back
            </Button>
          </Stack>
        )}

        {step === "done" && (
          <Stack spacing={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                const target = callbackUrl 
                  ? `/dashboard?callbackUrl=${encodeURIComponent(callbackUrl)}` 
                  : "/dashboard";
                router.replace(target);
              }}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 700,
                '&:hover': {
                  bgcolor: '#00D1DA',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)'
                }
              }}
            >
              Set New Master Password
            </Button>
          </Stack>
        )}
      </Paper>
      
      <SudoModal 
        isOpen={isSudoOpen} 
        onSuccess={onSudoSuccess} 
        onCancel={() => setIsSudoOpen(false)} 
        intent="reset"
      />
    </Box>
  );
}
