"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Typography,
  Box, 
  Stack, 
  CircularProgress
} from "@mui/material";
import { startRegistration } from "@simplewebauthn/browser";
import { AppwriteService } from "@/lib/appwrite";
import toast from "react-hot-toast";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import { masterPassCrypto } from "@/lib/masterpass-crypto";

interface PasskeySetupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trustUnlocked?: boolean;
}

// Helper to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function PasskeySetup({
  isOpen,
  onClose,
  userId,
  onSuccess,
  trustUnlocked = false,
}: PasskeySetupProps) {
  const [step, setStep] = useState(trustUnlocked ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const verifyMasterPassword = async () => {
    if (!masterPassword.trim()) {
      toast.error("Please enter your master password.");
      return false;
    }
    
    setVerifyingPassword(true);
    try {
      const isValid = await masterPassCrypto.unlock(masterPassword, userId);
      if (isValid) {
        return true;
      } else {
        toast.error("Incorrect master password.");
        return false;
      }
    } catch (_error: unknown) {
      console.error("Password verification failed:", _error);
      toast.error("Failed to verify master password.");
      return false;
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleContinueToName = async () => {
    const isValid = await verifyMasterPassword();
    if (isValid) {
      setStep(2);
    }
  };

  const handleContinueToCreate = () => {
    if (!passkeyName.trim()) {
      toast.error("Please name your passkey.");
      return;
    }
    setStep(3);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = arrayBufferToBase64(challenge.buffer);

      const userIdBytes = new TextEncoder().encode(userId);
      const registrationOptions = {
        challenge: challengeBase64,
        rp: {
          name: "Kylrix",
          id: window.location.hostname,
        },
        user: {
          id: arrayBufferToBase64(userIdBytes.buffer as ArrayBuffer),
          name: userId,
          displayName: userId,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" as const }, { alg: -257, type: "public-key" as const }],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          residentKey: "required" as const,
          userVerification: "preferred" as const,
        },
        timeout: 60000,
        attestation: "none" as const,
      };

      const regResp = await startRegistration({ optionsJSON: registrationOptions as any });

      const encoder = new TextEncoder();
      const credentialData = encoder.encode(regResp.id + userId);
      const kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
      const kwrap = await crypto.subtle.importKey(
        "raw",
        kwrapSeed,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );

      // We need the MEK to wrap it
      const { ecosystemSecurity } = await import("@/lib/ecosystem/security");
      const masterKey = ecosystemSecurity.getMasterKey();
      if (!masterKey) throw new Error("Vault is locked.");

      const rawMasterKey = await crypto.subtle.exportKey("raw", masterKey);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedMasterKey = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        kwrap,
        rawMasterKey,
      );

      const combined = new Uint8Array(
        iv.length + encryptedMasterKey.byteLength,
      );
      combined.set(iv);
      combined.set(new Uint8Array(encryptedMasterKey), iv.length);
      const passkeyBlob = arrayBufferToBase64(combined.buffer);

      await AppwriteService.createKeychainEntry({
        userId,
        type: 'passkey',
        credentialId: regResp.id,
        wrappedKey: passkeyBlob,
        salt: "", 
        params: JSON.stringify({
          name: passkeyName,
          publicKey: regResp.response.publicKey || "",
          counter: 0,
          transports: regResp.response.transports || [],
          created: new Date().toISOString(),
          rpId: window.location.hostname,
        }),
        isBackup: false
      });

      setStep(4);
    } catch (_error: unknown) {
      console.error("Passkey setup failed:", _error);
      toast.error(`Failed to create passkey.`);
    }
    setLoading(false);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: '28px',
          bgcolor: '#000000',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          width: '100%',
          maxWidth: '400px'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 900, 
        textAlign: 'center',
        pt: 4,
        pb: 1
      }}>
        Add New Passkey
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {step === 1 && (
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Step 1: Verify Master Password
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Please verify your master password to continue.
                </Typography>
              </Box>
              <TextField
                fullWidth
                type={showPassword ? "text" : "password"}
                placeholder="Master Password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                variant="filled"
                InputProps={{
                  disableUnderline: true,
                  sx: { borderRadius: '16px', bgcolor: '#161514' },
                  endAdornment: (
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'text.secondary' }}>
                      {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  )
                }}
              />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Step 2: Name Passkey
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Give this passkey a name to identify it later.
                </Typography>
              </Box>
              <TextField
                fullWidth
                placeholder="Passkey Name"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                variant="filled"
                autoFocus
                InputProps={{
                  disableUnderline: true,
                  sx: { borderRadius: '16px', bgcolor: '#161514' }
                }}
              />
            </Stack>
          )}

          {step === 3 && (
            <Stack spacing={3} sx={{ textAlign: 'center' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Step 3: Create Passkey
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Click &ldquo;Create Passkey&rdquo; and follow your device&rsquo;s prompts.
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: '16px', 
                  bgcolor: '#1F1D1B', 
                  border: '1px dashed rgba(168, 85, 247, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <FingerprintIcon sx={{ fontSize: 32, color: '#A855F7' }} />
                  <Typography variant="caption" sx={{ color: '#A855F7', fontWeight: 600 }}>
                    Face ID • Touch ID • Biometrics
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}

          {step === 4 && (
            <Stack spacing={3} sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ 
                width: 64, 
                height: 64, 
                borderRadius: '50%', 
                bgcolor: '#1F1D1B', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 1
              }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: "#4CAF50" }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#4CAF50', mb: 1 }}>
                  Passkey Added!
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  You can now use your passkey to unlock your ecosystem session.
                </Typography>
              </Box>
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 4, pt: 0, gap: 1.5 }}>
        {step === 1 && (
          <Button
            onClick={handleContinueToName}
            disabled={!masterPassword.trim() || verifyingPassword}
            variant="contained"
            fullWidth
            sx={{ borderRadius: "12px" }}
          >
            {verifyingPassword ? <CircularProgress size={20} /> : "Verify"}
          </Button>
        )}

        {step === 2 && (
          <Button
            onClick={handleContinueToCreate}
            disabled={!passkeyName.trim()}
            variant="contained"
            fullWidth
            sx={{ borderRadius: "12px" }}
          >
            Continue
          </Button>
        )}

        {step === 3 && (
          <Button
            onClick={handleCreate}
            disabled={loading}
            variant="contained"
            fullWidth
            sx={{ borderRadius: "12px" }}
          >
            {loading ? <CircularProgress size={20} /> : "Create Passkey"}
          </Button>
        )}

        {step === 4 && (
          <Button
            onClick={() => {
              onSuccess();
              handleClose();
            }}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '12px' }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
