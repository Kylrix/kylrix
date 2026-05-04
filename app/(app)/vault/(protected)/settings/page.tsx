'use client';

import React, { useState, useEffect, useCallback } from "react";
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  Stack, 
  Switch, 
  FormControlLabel, 
  Divider,
  CircularProgress,
  alpha,
  useTheme,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment
} from "@mui/material";
import { 
  Lock, 
  Shield, 
  Fingerprint,
  Trash2,
  AlertTriangle,
  KeyRound,
  CheckCircle2
} from "lucide-react";
import { useAppwriteVault } from "@/context/appwrite-context";
import { MasterPassModal } from "@/components/overlays/MasterPassModal";
import { PasskeySetup } from "@/components/overlays/passkeySetup";
import { DiscoverabilitySettings } from "@/components/settings/DiscoverabilitySettings";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { AppwriteService } from "@/lib/appwrite";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const muiTheme = useTheme();
  const { user } = useAppwriteVault();
  const [isUnlocked, setIsUnlocked] = useState(masterPassCrypto.isVaultUnlocked());
  const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Master Password Change state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Passkey state
  const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);

  const loadPasskeys = useCallback(async () => {
    if (!user?.$id) return;
    try {
        const entries = await AppwriteService.listKeychainEntries(user.$id);
        const pkEntries = entries.filter(e => e.type === 'passkey').map(e => ({
            ...e,
            params: typeof e.params === 'string' ? JSON.parse(e.params) : e.params
        }));
        
        setPasskeyEntries(pkEntries);
    } catch (_e) {
        console.error("Failed to load passkeys", _e);
    }
  }, [user?.$id]);

  useEffect(() => {
    
    const interval = setInterval(() => {
      const currentUnlocked = masterPassCrypto.isVaultUnlocked();
      if (currentUnlocked !== isUnlocked) {
        setIsUnlocked(currentUnlocked);
      }
    }, 1000);
    
    if (user?.$id) {
        loadPasskeys();
    }

    return () => clearInterval(interval);
  }, [isUnlocked, user?.$id, loadPasskeys]);

  const handleRemovePasskey = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this passkey? This cannot be undone.")) return;
    try {
        await AppwriteService.deleteKeychainEntry(id);
        toast.success("Passkey removed");
        loadPasskeys();
    } catch (_e) {
        toast.error("Failed to remove passkey");
    }
  };

  const handleResetMasterPassword = async () => {
    if (!window.confirm("CRITICAL: This will PERMANENTLY delete all your Vault items, Connect DMs, and Passkeys. Your Notes and Flow tasks will be preserved. Are you absolutely sure?")) {
      return;
    }

    setLoading(true);
    try {
      const success = await (masterPassCrypto as any).resetMasterPassword();
      if (success) {
        toast.success("Vault Reset & Data Purge Complete");
        setIsUnlocked(false);
        // Force refresh to setup state
        window.location.reload();
      } else {
        toast.error("Reset failed. Please try again or contact support.");
      }
    } catch (_e) {
      toast.error("An error occurred during reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    masterPassCrypto.lockNow();
    setIsUnlocked(false);
    toast.success("Vault Locked");
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await masterPassCrypto.changeMasterPassword(newPassword, user!.$id);
      toast.success("Master password changed successfully!");
      setPasswordModalOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isKylrixDomain = typeof window !== 'undefined' && 
    (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-clash)', letterSpacing: '-0.04em' }}>
        Settings
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 5, fontWeight: 500 }}>
        Manage your security preferences and application behavior.
      </Typography>

      <Stack spacing={5}>
        <DiscoverabilitySettings />
        {/* Security Section */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 2.5, display: 'block', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Security & Encryption
          </Typography>
          
          <Paper sx={{ 
            p: 4, 
            borderRadius: '28px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative',
            boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '28px',
            },
          }}>
            <Stack spacing={4}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)' }}>Vault Session</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Your current encryption status</Typography>
                </Box>
                <Button 
                  variant={isUnlocked ? "outlined" : "contained"}
                  onClick={() => isUnlocked ? handleLock() : setUnlockModalOpen(true)}
                  color={isUnlocked ? "inherit" : "primary"}
                  startIcon={isUnlocked ? <Lock size={18} /> : <Shield size={18} />}
                  sx={{ 
                    borderRadius: '14px', 
                    px: 3, 
                    py: 1.2, 
                    fontWeight: 800,
                    boxShadow: isUnlocked ? 'none' : '0 1px 0 rgba(0, 0, 0, 0.4)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    '&:hover': { bgcolor: isUnlocked ? 'rgba(255, 255, 255, 0.05)' : alpha('#6366F1', 0.8), borderColor: 'rgba(255, 255, 255, 0.2)' }
                  }}
                >
                  {isUnlocked ? "Lock Vault" : "Unlock Vault"}
                </Button>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)' }}>Master Password</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>Rotate your vault access key (Data stays safe)</Typography>
                </Box>
                <Button 
                  variant="outlined"
                  onClick={() => {
                    if (!isUnlocked) {
                      setUnlockModalOpen(true);
                    } else {
                      setPasswordModalOpen(true);
                    }
                  }}
                  startIcon={<KeyRound size={18} />}
                  sx={{ 
                    borderRadius: '14px', 
                    px: 3, 
                    py: 1.2, 
                    fontWeight: 700,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    '&:hover': { borderColor: 'rgba(255, 255, 255, 0.2)', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                  }}
                >
                  Change Password
                </Button>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

              {/* Passkey Management */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)', mb: 0.5 }}>Passkeys</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, maxWidth: '500px' }}>
                            Use your device biometric or hardware security key to unlock your vault.
                        </Typography>
                    </Box>
                    <Button 
                        variant="contained" 
                        size="small" 
                        startIcon={<Fingerprint size={16} />}
                        onClick={() => {
                            if (!isKylrixDomain) {
                                toast.error("Passkeys are only supported on kylrix.space");
                                return;
                            }
                            setPasskeySetupOpen(true);
                        }}
                        disabled={!isKylrixDomain}
                        sx={{ 
                            borderRadius: '12px', 
                            px: 2, 
                            py: 1, 
                            fontWeight: 800,
                            opacity: isKylrixDomain ? 1 : 0.5
                        }}
                    >
                        Add Passkey
                    </Button>
                </Box>

                <List sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: '18px', p: 0, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {passkeyEntries.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>No passkeys registered yet.</Typography>
                    </Box>
                ) : (
                    passkeyEntries.map((pk, idx) => (
                        <React.Fragment key={pk.$id}>
                            <ListItem 
                                sx={{ py: 2, px: 3 }}
                                secondaryAction={
                                    <IconButton edge="end" color="error" onClick={() => handleRemovePasskey(pk.$id)} sx={{ bgcolor: alpha('#ef4444', 0.05), '&:hover': { bgcolor: alpha('#ef4444', 0.1) } }}>
                                        <Trash2 size={18} />
                                    </IconButton>
                                }
                            >
                                <ListItemIcon sx={{ minWidth: 48 }}>
                                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', display: 'flex' }}>
                                      <Fingerprint size={20} />
                                    </Box>
                                </ListItemIcon>
                                <ListItemText 
                                    primary={pk.params?.name || `Passkey ${idx + 1}`}
                                    secondary={`Added on ${new Date(pk.$createdAt).toLocaleDateString()}`}
                                    primaryTypographyProps={{ fontWeight: 800, color: '#fff' }}
                                    secondaryTypographyProps={{ sx: { opacity: 0.5, fontWeight: 500 } }}
                                />
                            </ListItem>
                            {idx < passkeyEntries.length - 1 && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />}
                        </React.Fragment>
                    ))
                )}
                </List>

              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
            </Stack>
          </Paper>
        </Box>

        {/* Preferences Section */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', mb: 2.5, display: 'block', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Preferences
          </Typography>
          <Paper sx={{ 
            p: 4, 
            borderRadius: '28px', 
            bgcolor: '#161412', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
          }}>
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch defaultChecked color="primary" />}
                label={
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)' }}>Auto-Lock Session</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block' }}>Lock vault after 15 minutes of inactivity</Typography>
                  </Box>
                }
                sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse', py: 1.5 }}
              />
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
              <FormControlLabel
                control={<Switch color="primary" />}
                label={
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)' }}>Clipboard Auto-Clear</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block' }}>Clear copied passwords after 30 seconds</Typography>
                  </Box>
                }
                sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse', py: 1.5 }}
              />
            </Stack>
          </Paper>
        </Box>

        {/* Danger Zone */}
        <Box sx={{ pt: 2 }}>
          <Paper sx={{ 
            p: 4, 
            borderRadius: '28px', 
            bgcolor: alpha('#ef4444', 0.02), 
            border: '1px solid rgba(239, 68, 68, 0.1)',
          }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#ef4444', mb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: 'var(--font-clash)' }}>
              <AlertTriangle size={22} /> Danger Zone
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 4, maxWidth: '600px' }}>
              Once you reset your master password, all currently stored local data will be wiped to protect your privacy. This action is IRREVERSIBLE.
            </Typography>
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Trash2 size={18} />}
              onClick={handleResetMasterPassword}
              disabled={loading}
              sx={{ 
                borderRadius: '14px', 
                fontWeight: 800, 
                px: 3, 
                py: 1.2,
                borderColor: alpha('#ef4444', 0.3),
                '&:hover': {
                  borderColor: '#ef4444',
                  bgcolor: alpha('#ef4444', 0.05)
                }
              }}
            >
              {loading ? "Wiping Data..." : "Reset Vault & Wipe Data"}
            </Button>
          </Paper>
        </Box>
      </Stack>

      <MasterPassModal 
        isOpen={unlockModalOpen}
        onClose={() => {
          setUnlockModalOpen(false);
        }}
      />

      <PasskeySetup 
        isOpen={passkeySetupOpen}
        onClose={() => setPasskeySetupOpen(false)}
        userId={user?.$id || ""}
        onSuccess={() => {
            setPasskeySetupOpen(false);
            loadPasskeys();
        }}
        trustUnlocked={true}
      />

      {/* Change Password Modal */}
      <Dialog 
        open={passwordModalOpen} 
        onClose={() => !isChangingPassword && setPasswordModalOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: '#0A0A0A',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backgroundImage: 'none',
            maxWidth: '420px',
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ p: 4, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ 
              p: 1.2, 
              borderRadius: '12px', 
              bgcolor: alpha(muiTheme.palette.primary.main, 0.1),
              color: muiTheme.palette.primary.main,
              display: 'flex'
            }}>
              <KeyRound size={20} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)' }}>
              Change Password
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            Update your master access key. Your data will be re-wrapped with the new password.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 4, pt: 1 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              type="password"
              label="New Master Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isChangingPassword}
              variant="filled"
              InputProps={{ 
                disableUnderline: true, 
                sx: { borderRadius: '14px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={18} style={{ opacity: 0.4 }} />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isChangingPassword}
              variant="filled"
              InputProps={{ 
                disableUnderline: true, 
                sx: { borderRadius: '14px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                startAdornment: (
                  <InputAdornment position="start">
                    <CheckCircle2 size={18} style={{ opacity: 0.4 }} />
                  </InputAdornment>
                )
              }}
            />
            
            <Box sx={{ 
              p: 2, 
              borderRadius: '16px', 
              bgcolor: alpha(muiTheme.palette.warning.main, 0.05),
              border: `1px solid ${alpha(muiTheme.palette.warning.main, 0.1)}`,
              display: 'flex',
              gap: 1.5
            }}>
              <AlertTriangle size={18} color={muiTheme.palette.warning.main} style={{ flexShrink: 0, marginTop: '2px' }} />
              <Typography variant="caption" sx={{ color: muiTheme.palette.warning.main, opacity: 0.8 }}>
                Changing your password will NOT wipe your data, but it will invalidate any existing Passkeys. You will need to re-add them after changing.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 4, pt: 0 }}>
          <Button 
            fullWidth
            onClick={() => setPasswordModalOpen(false)}
            disabled={isChangingPassword}
            sx={{ borderRadius: '12px', py: 1.5, fontWeight: 700, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            fullWidth
            variant="contained"
            onClick={handleChangePassword}
            disabled={isChangingPassword || !newPassword || newPassword !== confirmPassword}
            sx={{ borderRadius: '12px', py: 1.5, fontWeight: 800 }}
          >
            {isChangingPassword ? <CircularProgress size={20} color="inherit" /> : "Update Password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
