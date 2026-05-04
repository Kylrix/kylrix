"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha } from "@mui/material/styles";
import { startRegistration } from "@simplewebauthn/browser";
import { AppwriteService } from "@/lib/appwrite/client";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import toast from "react-hot-toast";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FingerprintOutlined as FingerprintIcon } from "@mui/icons-material";

interface PasskeySetupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trustUnlocked?: boolean;
}

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
  const router = useRouter();
  const [step, setStep] = useState(trustUnlocked && ecosystemSecurity.status.isUnlocked ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const verifyMasterPassword = async () => {
    // Enforcement: Check if master password exists before allowing verification/passkey setup
    const masterpassSet = await AppwriteService.hasMasterpass(userId);
    if (!masterpassSet) {
      toast.error("You must set a master password before adding a passkey.");
      router.push("/settings"); // Flow uses /settings for security
      onClose();
      return false;
    }

    if (!masterPassword.trim()) {
      toast.error("Please enter your master password.");
      return false;
    }
    
    setVerifyingPassword(true);
    try {
      const entries = await AppwriteService.listKeychainEntries(userId);
      const passwordEntry = entries.find((e: any) => e.type === 'password');
      
      if (!passwordEntry) {
          toast.error("No master password setup found.");
          return false;
      }

      const isValid = await ecosystemSecurity.unlock(masterPassword, passwordEntry);
      if (isValid) {
        return true;
      } else {
        toast.error("Incorrect master password.");
        return false;
      }
    } catch (error: unknown) {
      console.error("Password verification failed:", error);
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
      const masterKey = ecosystemSecurity.getMasterKey();
      
      if (!masterKey) {
          throw new Error("Vault is locked. Please enter master password.");
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = arrayBufferToBase64(challenge.buffer);

      const userIdBytes = new TextEncoder().encode(userId);
      const registrationOptions = {
        challenge: challengeBase64,
        rp: {
          name: "Kylrix",
          id: "kylrix.space",
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

      const regResp = await startRegistration({ optionsJSON: registrationOptions });

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
          rpId: "kylrix.space",
        }),
        isBackup: false
      });

      setStep(4);
    } catch (error: unknown) {
      console.error("Passkey setup failed:", error);
      const err = error as { name?: string; message?: string };
      const message =
        err.name === "InvalidStateError"
          ? "This passkey is already registered."
          : err.message;
      toast.error(`Failed to create passkey: ${message}`);
    }
    setLoading(false);
  };

  const resetDialog = () => {
    setStep(1);
    setLoading(false);
    setMasterPassword("");
    setPasskeyName("");
    setShowPassword(false);
  };

  const handleClose = () => {
    if (userId) {
      localStorage.setItem(`passkey_skip_${userId}`, Date.now().toString());
    }
    resetDialog();
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: '24px',
          bgcolor: 'rgba(15, 13, 12, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          width: '100%',
          maxWidth: '400px'
        }
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 900, 
        fontFamily: '"Space Grotesk", sans-serif', 
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
                onKeyDown={(e) => e.key === "Enter" && handleContinueToName()}
                variant="filled"
                InputProps={{
                  disableUnderline: true,
                  sx: { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' },
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
                placeholder="e.g. My Phone"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinueToCreate()}
                variant="filled"
                autoFocus
                InputProps={{
                  disableUnderline: true,
                  sx: { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }
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
                  p: 3, 
                  borderRadius: '16px', 
                  bgcolor: 'rgba(0, 240, 255, 0.05)', 
                  border: '1px dashed rgba(0, 240, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <FingerprintIcon sx={{ fontSize: 40, color: '#00F0FF' }} />
                  <Typography variant="caption" sx={{ color: '#00F0FF', fontWeight: 600 }}>
                    Device Security • Platform Authenticator
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
                bgcolor: 'rgba(76, 175, 80, 0.1)', 
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
                  You can now use <strong>{passkeyName}</strong> to unlock your session.
                </Typography>
              </Box>
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 4, pt: 0, gap: 1.5 }}>
        {step === 1 && (
          <>
            <Button onClick={handleClose} variant="outlined" fullWidth sx={{ borderRadius: '12px' }}>
              Cancel
            </Button>
            <Button
              onClick={handleContinueToName}
              disabled={!masterPassword.trim() || verifyingPassword}
              variant="contained"
              fullWidth
              sx={{ borderRadius: '12px' }}
            >
              {verifyingPassword ? <CircularProgress size={20} /> : "Continue"}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Button onClick={() => setStep(1)} variant="outlined" fullWidth sx={{ borderRadius: '12px' }}>
              Back
            </Button>
            <Button
              onClick={handleContinueToCreate}
              disabled={!passkeyName.trim()}
              variant="contained"
              fullWidth
              sx={{ borderRadius: '12px' }}
            >
              Continue
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <Button
              variant="outlined"
              onClick={() => setStep(2)}
              disabled={loading}
              fullWidth
              sx={{ borderRadius: '12px' }}
            >
              Back
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={loading}
              variant="contained"
              fullWidth
              sx={{ borderRadius: '12px', bgcolor: '#00F0FF', color: 'black', '&:hover': { bgcolor: alpha('#00F0FF', 0.8) } }}
            >
              {loading ? <CircularProgress size={20} /> : "Create Passkey"}
            </Button>
          </>
        )}

        {step === 4 && (
          <Button
            onClick={() => {
              onSuccess();
              handleClose();
            }}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '12px', bgcolor: '#00F0FF', color: 'black' }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
