"use client";

import { Box, Container, Typography, Button, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useAppwriteVault } from "@/context/appwrite-context";
import { useRouter } from "next/navigation";

export default function CTA() {
  // Use the app's secondary color for the primary hero CTA to balance branding
  const VAULT_SECONDARY = "#10B981";
  const { user, openIDMWindow, isAuthenticating } = useAppwriteVault();
  const router = useRouter();

  return (
    <Box sx={{ py: 20, textAlign: 'center', position: 'relative' }}>
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        height: '100%',
        // keep the subtle ecosystem radial as a background accent for balance
        background: 'radial-gradient(circle at bottom, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-space-grotesk)' }}>
          Ready to secure your digital life?
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 6 }}>
          Join thousands of users who trust Kylrix Vault with their passwords.
        </Typography>
        <Button
          variant="contained"
          size="large"
          style={{ backgroundColor: VAULT_SECONDARY, color: '#000' }}
          endIcon={isAuthenticating ? <CircularProgress size={20} color="inherit" /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}
          onClick={() => {
            if (user) {
              router.push("/dashboard");
              return;
            }
            try {
              openIDMWindow();
            } catch (err: unknown) {
              alert(err instanceof Error ? err.message : "Failed to open authentication");
            }
          }}
        sx={{
            bgcolor: VAULT_SECONDARY,
            // ensure MUI contained button styles don't override our app-specific color
            '&.MuiButton-contained': { bgcolor: VAULT_SECONDARY },
            '&.MuiButton-contained:hover': { bgcolor: alpha(VAULT_SECONDARY, 0.85) },
            color: '#000',
            px: 6,
            py: 2.5,
            borderRadius: '20px',
            fontWeight: 900,
            fontSize: '1.2rem',
            '&:hover': {
              bgcolor: alpha(VAULT_SECONDARY, 0.85),
              transform: 'scale(1.05)',
              boxShadow: `0 20px 40px ${alpha(VAULT_SECONDARY, 0.4)}`
            },
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {user ? "Go to Dashboard" : "Get Started Free"}
        </Button>
        <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          No credit card required • Free forever
        </Typography>
      </Container>
    </Box>
  );
}
