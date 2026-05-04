"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Drawer, 
  Button, 
  TextField, 
  Box, 
  Typography, 
  IconButton, 
  CircularProgress,
  alpha,
  Stack,
  useTheme,
  useMediaQuery
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MailIcon from "@mui/icons-material/Mail";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { createPasswordRecovery, updatePasswordRecovery } from "@/lib/appwrite";
import toast from "react-hot-toast";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [loading, setLoading] = useState(false);

  const userId = params.get("userId") || "";
  const secret = params.get("secret") || "";

  const showResetForm = !!userId && !!secret;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPasswordRecovery(
        email,
        window.location.origin,
      );
      toast.success("Password reset email sent! Check your inbox.");
      setEmail("");
    } catch (_e: unknown) {
      const err = _e as { message?: string };
      toast.error(err.message || "Error sending reset email.");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordAgain) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await updatePasswordRecovery(userId, secret, password);
      toast.success("Password reset successful! You can now log in.");
      onClose();
    } catch (_e: unknown) {
      const err = _e as { message?: string };
      toast.error(err.message || "Error resetting password.");
    }
    setLoading(false);
  };

  return (
    <Drawer 
      anchor={isMobile ? 'bottom' : 'right'}
      open={isOpen} 
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
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
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          color: 'rgba(255, 255, 255, 0.3)',
          zIndex: 1,
          '&:hover': { color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.05)' }
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Box sx={{ p: 4, textAlign: 'center', flex: 1, overflowY: 'auto' }}>
        <Box sx={{ 
          width: 64, 
          height: 64, 
          borderRadius: '20px', 
          bgcolor: alpha('#6366F1', 0.1), 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          mx: 'auto',
          mb: 3
        }}>
          {showResetForm ? <VpnKeyIcon sx={{ fontSize: 32, color: "#6366F1" }} /> : <MailIcon sx={{ fontSize: 32, color: "#6366F1" }} />}
        </Box>
        <Typography variant="h5" sx={{ 
          fontWeight: 900, 
          fontFamily: 'var(--font-space-grotesk)',
          letterSpacing: '-0.02em',
          mb: 1
        }}>
          {showResetForm ? "Set New Password" : "Reset Password"}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500, mb: 4 }}>
          {showResetForm 
            ? "Enter your new secure password below." 
            : "Enter your email to receive a password recovery link."}
        </Typography>

        <form onSubmit={showResetForm ? handleReset : handleRequest}>
          <Stack spacing={2.5}>
            {showResetForm ? (
              <>
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                    }
                  }}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={passwordAgain}
                  onChange={(e) => setPasswordAgain(e.target.value)}
                  required
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                    }
                  }}
                />
              </>
            ) : (
              <TextField
                fullWidth
                type="email"
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                  }
                }}
              />
            )}

            <Button 
              fullWidth 
              type="submit" 
              variant="contained" 
              disabled={loading}
              sx={{ 
                borderRadius: '16px', 
                py: 1.8, 
                fontWeight: 800,
                bgcolor: '#6366F1',
                color: '#000',
                mt: 1,
                '&:hover': { bgcolor: '#00D1DA' },
                '&.Mui-disabled': { bgcolor: 'rgba(99, 102, 241, 0.3)' }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : (showResetForm ? "Update Password" : "Send Reset Link")}
            </Button>
          </Stack>
        </form>
      </Box>
    </Drawer>
  );
}
