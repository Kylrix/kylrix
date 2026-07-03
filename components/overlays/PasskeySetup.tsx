"use client";

import { useState, useEffect } from 'react';
import {
  Drawer,
  Button,
  TextField,
  IconButton,
  Typography,
  Box,
  Stack,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Divider,
} from '@/lib/openbricks/primitives';
import { startRegistration } from '@simplewebauthn/browser';
import { AppwriteService } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { getPasskeyRegisterFallbackSeedAction, verifyPasskeyRegistrationAction } from '@/lib/actions/auth-actions';
import { bufferToBase64Url } from '@/lib/webauthn-utils';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
} from '@/lib/openbricks/icons';
import { Fingerprint, X, Key, ChevronDown, ChevronUp } from 'lucide-react';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export interface PasskeySetupPanelProps {
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trustUnlocked?: boolean;
}

interface PasskeySetupProps extends PasskeySetupPanelProps {
  open: boolean;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function PasskeySetupPanel({
  onClose,
  userId,
  onSuccess,
  trustUnlocked = false,
}: PasskeySetupPanelProps) {
  const router = useRouter();
  const obTheme = useTheme();
  const isDesktop = useMediaQuery(obTheme.breakpoints.up('md'));
  const { setIsDrawerOpen } = useDrawerState();
  const { open: openDrawer } = useUnifiedDrawer();

  const handleAlsoUseForLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (!checked) {
      openDrawer('delete-confirm', {
        title: 'Disable Passkey Login?',
        description: 'WARNING: Disabling this will prevent you from signing into your account using this passkey. If you also disable MasterPass login, you could permanently lose access to your account and be unable to decrypt your data. Are you sure you want to proceed?',
        confirmLabel: 'Disable',
        onConfirm: () => {
          setAlsoUseForLogin(false);
        }
      });
    } else {
      setAlsoUseForLogin(true);
    }
  };

  useEffect(() => {
    setIsDrawerOpen(true);
    return () => setIsDrawerOpen(false);
  }, [setIsDrawerOpen]);

  const [step, setStep] = useState(trustUnlocked && ecosystemSecurity.status.isUnlocked ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [alsoUseForLogin, setAlsoUseForLogin] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const verifyMasterPassword = async () => {
    const masterpassSet = await AppwriteService.hasMasterpass(userId);
    if (!masterpassSet) {
      toast.error("You must set a master password before adding a passkey.");
      router.push("/masterpass");
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
      }

      toast.error("Incorrect master password.");
      return false;
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
      const challengeBase64 = bufferToBase64Url(challenge.buffer);

      const userIdBytes = new TextEncoder().encode(userId);
      const rpId = resolvePasskeyRpId(window.location.hostname);
      const registrationOptions: any = {
        challenge: challengeBase64,
        rp: {
          name: "Kylrix",
          id: rpId,
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

      if (alsoUseForLogin) {
        registrationOptions.extensions = {
          prf: {}
        };
      }

      const regResp = await startRegistration({ optionsJSON: registrationOptions });
      const extensionResults = regResp.clientExtensionResults as any;

      let kwrapSeed: ArrayBuffer;
      let isAuthPasskey = alsoUseForLogin;

      if (alsoUseForLogin && extensionResults?.prf?.enabled) {
        const prfBuffer = extensionResults?.prf?.results?.first;
        if (prfBuffer) {
          kwrapSeed = prfBuffer;
        } else {
          const fallbackRes = await getPasskeyRegisterFallbackSeedAction(regResp.id);
          if (fallbackRes.success && fallbackRes.seed) {
            kwrapSeed = new Uint8Array(
              atob(fallbackRes.seed).split("").map(c => c.charCodeAt(0))
            ).buffer;
          } else {
            const encoder = new TextEncoder();
            const credentialData = encoder.encode(regResp.id + userId);
            kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
          }
        }
      } else {
        const fallbackRes = await getPasskeyRegisterFallbackSeedAction(regResp.id);
        if (fallbackRes.success && fallbackRes.seed) {
          kwrapSeed = new Uint8Array(
            atob(fallbackRes.seed).split("").map(c => c.charCodeAt(0))
          ).buffer;
        } else {
          const encoder = new TextEncoder();
          const credentialData = encoder.encode(regResp.id + userId);
          kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
        }
      }

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

      // Verify registration response on the server to get the correct COSE public key
      const verifyRegRes = await verifyPasskeyRegistrationAction(
        regResp,
        challengeBase64,
        window.location.hostname,
        window.location.host
      );

      if (!verifyRegRes.success || !verifyRegRes.publicKey) {
        throw new Error(verifyRegRes.error || 'Failed to verify passkey registration on server');
      }

      const cosePublicKey = verifyRegRes.publicKey;

      await AppwriteService.createKeychainEntry({
        userId,
        type: 'passkey',
        credentialId: regResp.id,
        wrappedKey: passkeyBlob,
        salt: "",
        params: JSON.stringify({
          name: passkeyName,
          publicKey: cosePublicKey,
          counter: 0,
          transports: regResp.response.transports || [],
          created: new Date().toISOString(),
          rpId,
          prf: !!(alsoUseForLogin && extensionResults?.prf?.enabled && extensionResults?.prf?.results?.first),
        }),
        isBackup: false,
        authPass: false,
        publicKey: cosePublicKey,
        authPasskey: isAuthPasskey,
      });

      try {
        const { logPasskeyAdded } = await import('@/lib/audit');
        logPasskeyAdded(userId, { name: passkeyName });
      } catch {
        // audit is best-effort
      }

      try {
        const { sendKylrixEmailNotification } = await import('@/lib/email-notifications');
        await sendKylrixEmailNotification({
          eventType: 'passkey_added',
          sourceApp: 'accounts',
          verificationMode: 'silent',
          recipientIds: [userId],
          resourceTitle: passkeyName || 'Passkey',
          resourceType: 'passkey',
          templateKey: 'accounts:passkey-added',
          ctaUrl: '/settings',
          ctaText: 'Review security settings',
        });
      } catch (emailErr) {
        console.warn('[PasskeySetup] Failed to queue passkey added email', emailErr);
      }

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

  const resetFlow = () => {
    setStep(trustUnlocked && ecosystemSecurity.status.isUnlocked ? 2 : 1);
    setLoading(false);
    setMasterPassword("");
    setPasskeyName("");
    setShowPassword(false);
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: isDesktop ? '100%' : 'auto', maxHeight: isDesktop ? '100dvh' : '85dvh', color: 'white' }}>
      {!isDesktop && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            pt: 1.5,
            pb: 0.5,
            cursor: 'pointer',
          }}
          onClick={handleClose}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.15)' }} />
        </Box>
      )}

      <Box sx={{ px: 3, pt: isDesktop ? 3 : 1.5, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Fingerprint size={24} color={obTheme.palette.primary.main} />
          <Typography sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', fontSize: '1.15rem' }}>
            Add New Passkey
          </Typography>
        </Stack>
        <IconButton onClick={handleClose} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white' } }}>
          <X size={20} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMasterPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleContinueToName()}
              variant="filled"
              InputProps={{
                disableUnderline: true,
                sx: { borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.05)' },
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasskeyName(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleContinueToCreate()}
              variant="filled"
              autoFocus
              InputProps={{
                disableUnderline: true,
                sx: { borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.05)' }
              }}
            />

            {/* Expandable Advanced Options */}
            <Box>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                }}
              >
                <span>{showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}</span>
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              
              {showAdvanced && (
                <Box 
                  sx={{ 
                    mt: 2, 
                    p: 2, 
                    borderRadius: '16px', 
                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: 2 
                  }}
                >
                  <Box sx={{ flex: 1, pr: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'white' }}>
                      Also Use for Login
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.75rem', display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                      Allow using this passkey to sign in to your account.
                    </Typography>
                  </Box>
                  <input
                    type="checkbox"
                    checked={alsoUseForLogin}
                    onChange={handleAlsoUseForLoginChange}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#6366F1',
                      cursor: 'pointer',
                    }}
                  />
                </Box>
              )}
            </Box>
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
                bgcolor: 'rgba(0, 240, 255, 0.05)',
                border: '1px dashed rgba(0, 240, 255, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1
              }}>
                <Fingerprint size={32} color={obTheme.palette.primary.main} />
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Face ID • Touch ID • Windows Hello
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

      <Box sx={{ px: 3, pb: 'calc(24px + env(safe-area-inset-bottom))', pt: 1, display: 'flex', gap: 1.5, flexDirection: isDesktop ? 'row' : 'column' }}>
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
              sx={{ borderRadius: '12px' }}
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
            sx={{ borderRadius: '12px' }}
          >
            Done
          </Button>
        )}
      </Box>
    </Box>
  );
}

export function PasskeySetup({
  open,
  onClose,
  userId,
  onSuccess,
  trustUnlocked = false,
}: PasskeySetupProps) {
  const obTheme = useTheme();
  const isDesktop = useMediaQuery(obTheme.breakpoints.up('md'));

  if (!open) return null;

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          width: isDesktop ? 'min(480px, 90vw)' : '100%',
          maxWidth: '100%',
          maxHeight: isDesktop ? '100dvh' : '85dvh',
          borderTopLeftRadius: isDesktop ? 0 : '28px',
          borderTopRightRadius: isDesktop ? 0 : '28px',
          bgcolor: '#161412',
          borderTop: isDesktop ? 0 : '1px solid rgba(255, 255, 255, 0.06)',
          borderLeft: isDesktop ? '1px solid rgba(255, 255, 255, 0.06)' : 0,
          backgroundImage: 'none',
          color: 'white',
          p: 0,
        },
      }}
    >
      <PasskeySetupPanel
        onClose={onClose}
        userId={userId}
        onSuccess={onSuccess}
        trustUnlocked={trustUnlocked}
      />
    </Drawer>
  );
}
