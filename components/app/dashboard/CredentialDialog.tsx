import { useState, useEffect } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import LanguageIcon from "@mui/icons-material/Language";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DescriptionIcon from "@mui/icons-material/Description";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { 
  Drawer,
  Button, 
  TextField, 
  IconButton, 
  InputAdornment, 
  Box, 
  Typography, 
  Grid,
  alpha,
  useTheme,
  useMediaQuery,
  Stack,
  Divider
} from "@mui/material";
import { createCredential, updateCredential } from "@/lib/appwrite";
import type { Credentials, CredentialsCreate } from "@/lib/appwrite/types";
import { useAppwriteVault } from "@/context/appwrite-context";
import { generateRandomPassword } from "@/utils/password";

const VAULT_PRIMARY = "#10B981"; // Emerald
const SURFACE_COLOR = "#161412";
const BG_COLOR = "#0A0908";

export default function CredentialDialog({
  open,
  onClose,
  initial,
  onSaved,
  prefill,
  defaultType = "login",
}: {
  open: boolean;
  onClose: () => void;
  initial?: Credentials | null;
  onSaved: () => void;
  prefill?: { name?: string; url?: string; username?: string };
  defaultType?: string;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAppwriteVault();
  const [showPassword, setShowPassword] = useState(false);
  const [customFields, setCustomFields] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    url: "",
    notes: "",
    tags: "",
    cardNumber: "",
    cardholderName: "",
    cardExpiry: "",
    cardCVV: "",
    cardPIN: "",
    cardType: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        username: initial.username || "",
        password: initial.password || "",
        url: initial.url || "",
        notes: initial.notes || "",
        tags: initial.tags ? initial.tags.join(", ") : "",
        cardNumber: initial.cardNumber || "",
        cardholderName: initial.cardholderName || "",
        cardExpiry: initial.cardExpiry || "" ,
        cardCVV: initial.cardCVV || "",
        cardPIN: initial.cardPIN || "",
        cardType: initial.cardType || "",
      });
      setCustomFields(
        initial.customFields ? JSON.parse(initial.customFields) : [],
      );
    } else {
      setForm({
        name: prefill?.name || "",
        username: prefill?.username || "",
        password: "",
        url: prefill?.url || "",
        notes: "",
        tags: "",
        cardNumber: "",
        cardholderName: "",
        cardExpiry: "",
        cardCVV: "",
        cardPIN: "",
        cardType: "",
      });
      setCustomFields([]);
    }
  }, [initial, open, prefill]);

  const handleGeneratePassword = () => {
    setForm({ ...form, password: generateRandomPassword(16) });
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), label: "", value: "" },
    ]);
  };

  const updateCustomField = (
    id: string,
    field: "label" | "value",
    value: string,
  ) => {
    setCustomFields(
      customFields.map((cf) => (cf.id === id ? { ...cf, [field]: value } : cf)),
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((cf) => cf.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!user) throw new Error("Not authenticated");

      const type = initial?.itemType || defaultType;

      const credentialData: CredentialsCreate = {
        userId: user.$id,
        itemType: type,
        name: form.name.trim(),
        url: null,
        username: null,
        notes: null,
        totpId: initial?.totpId || null,
        cardNumber: null,
        cardholderName: null,
        cardExpiry: null,
        cardCVV: null,
        cardPIN: null,
        cardType: null,
        folderId: initial?.folderId || null,
        tags: null,
        customFields: null,
        faviconUrl: null,
        isFavorite: initial?.isFavorite || false,
        isDeleted: initial?.isDeleted || false,
        deletedAt: initial?.deletedAt || null,
        lastAccessedAt: initial?.lastAccessedAt || null,
        passwordChangedAt: initial?.passwordChangedAt || null,
        password: null,
        createdAt:
          initial && initial.createdAt
            ? initial.createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (type === 'login') {
        credentialData.username = form.username.trim();
        credentialData.password = form.password.trim();
        if (form.url && form.url.trim()) credentialData.url = form.url.trim();
      } else if (type === 'card') {
        credentialData.cardNumber = form.cardNumber.trim();
        credentialData.cardholderName = form.cardholderName.trim();
        credentialData.cardExpiry = form.cardExpiry.trim();
        credentialData.cardCVV = form.cardCVV.trim();
        credentialData.cardPIN = form.cardPIN.trim();
        credentialData.cardType = form.cardType.trim();
      }

      if (form.notes && form.notes.trim())
        credentialData.notes = form.notes.trim();
      if (form.tags && form.tags.trim()) {
        const tagsArr = form.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (tagsArr.length > 0) credentialData.tags = tagsArr;
      }
      if (customFields.length > 0)
        credentialData.customFields = JSON.stringify(customFields) as string;

      if (initial && initial.$id) {
        await updateCredential(initial.$id, credentialData);
      } else {
        await createCredential(credentialData);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Failed to save credential.");
    }
    setLoading(false);
  };

  const currentType = initial?.itemType || defaultType;

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 600px)',
          maxWidth: '100%',
          height: isMobile ? '92dvh' : '100%',
          maxHeight: '100dvh',
          bgcolor: BG_COLOR,
          backdropFilter: 'blur(32px) saturate(200%)',
          border: isMobile ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ 
          p: 3, 
          pb: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          fontFamily: 'var(--font-space-grotesk)',
          fontWeight: 900,
          fontSize: '1.4rem',
          color: 'white',
          letterSpacing: '-0.02em',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: VAULT_PRIMARY, boxShadow: `0 0 15px ${VAULT_PRIMARY}` }} />
            {initial ? "Edit" : "New"} {currentType.charAt(0).toUpperCase() + currentType.slice(1)}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ 
          p: 3, 
          pt: 2.5,
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)'
            }
          }
        }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Name"
                placeholder="e.g., GitHub, Gmail"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                variant="filled"
                InputProps={{
                  disableUnderline: true,
                  sx: { 
                    borderRadius: '12px', 
                    bgcolor: SURFACE_COLOR,
                    border: '1px solid rgba(255,255,255,0.03)',
                    transition: 'all 0.2s ease',
                    '&.Mui-focused': {
                      border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                      bgcolor: 'rgba(255,255,255,0.01)'
                    }
                  }
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
              />
            </Grid>

            {currentType === 'login' && (
              <>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Username/Email"
                    placeholder="john@example.com"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                        </InputAdornment>
                      ),
                      sx: { 
                        borderRadius: '12px', 
                        bgcolor: SURFACE_COLOR,
                        border: '1px solid rgba(255,255,255,0.03)',
                        '&.Mui-focused': {
                          border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                        }
                      }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      variant="filled"
                      InputProps={{
                        disableUnderline: true,
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} size="small" sx={{ color: 'rgba(255,255,255,0.2)' }}>
                              {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: { 
                          borderRadius: '12px', 
                          bgcolor: SURFACE_COLOR,
                          border: '1px solid rgba(255,255,255,0.03)',
                          '&.Mui-focused': {
                            border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                          }
                        }
                      }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                    />
                    <IconButton 
                      onClick={handleGeneratePassword}
                      sx={{ 
                        bgcolor: alpha(VAULT_PRIMARY, 0.1), 
                        color: VAULT_PRIMARY,
                        borderRadius: '12px',
                        width: 56,
                        height: 56,
                        border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
                        '&:hover': { bgcolor: alpha(VAULT_PRIMARY, 0.2) },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <AutorenewIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Website URL"
                    type="url"
                    placeholder="https://example.com"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <LanguageIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                        </InputAdornment>
                      ),
                      sx: { 
                        borderRadius: '12px', 
                        bgcolor: SURFACE_COLOR,
                        border: '1px solid rgba(255,255,255,0.03)',
                        '&.Mui-focused': {
                          border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                        }
                      }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>
              </>
            )}

            {currentType === 'card' && (
              <>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Card Number"
                    placeholder="•••• •••• •••• ••••"
                    value={form.cardNumber}
                    onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                    required
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <CreditCardIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Cardholder Name"
                    placeholder="JOHN DOE"
                    value={form.cardholderName}
                    onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
                    required
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      sx: { borderRadius: '12px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Expiry"
                    placeholder="MM/YY"
                    value={form.cardExpiry}
                    onChange={(e) => setForm({ ...form, cardExpiry: e.target.value })}
                    required
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      sx: { borderRadius: '12px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="CVV"
                    placeholder="•••"
                    value={form.cardCVV}
                    onChange={(e) => setForm({ ...form, cardCVV: e.target.value })}
                    required
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      sx: { borderRadius: '12px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
                  />
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Tags"
                placeholder="work, email, private"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                variant="filled"
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocalOfferIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                    </InputAdornment>
                  ),
                  sx: { 
                    borderRadius: '12px', 
                    bgcolor: SURFACE_COLOR,
                    border: '1px solid rgba(255,255,255,0.03)',
                    '&.Mui-focused': {
                      border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                    }
                  }
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={currentType === 'note' ? "Note Content" : "Notes"}
                multiline
                rows={currentType === 'note' ? 10 : 3}
                placeholder={currentType === 'note' ? "Write your secure note here..." : "Secure notes..."}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                variant="filled"
                InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                      <DescriptionIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                    </InputAdornment>
                  ),
                  sx: { 
                    borderRadius: '12px', 
                    bgcolor: SURFACE_COLOR,
                    border: '1px solid rgba(255,255,255,0.03)',
                    '&.Mui-focused': {
                      border: `1px solid ${alpha(VAULT_PRIMARY, 0.3)}`,
                    }
                  }
                }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)', '&.Mui-focused': { color: VAULT_PRIMARY } } }}
              />
            </Grid>

            {/* Custom Fields */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-space-grotesk)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
                  Custom Fields
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                  onClick={addCustomField}
                  sx={{ 
                    borderRadius: '8px', 
                    color: VAULT_PRIMARY,
                    fontWeight: 700,
                    '&:hover': { bgcolor: alpha(VAULT_PRIMARY, 0.05) }
                  }}
                >
                  Add Field
                </Button>
              </Box>
              
              {customFields.map((field) => (
                <Box key={field.id} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField
                    size="small"
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => updateCustomField(field.id, "label", e.target.value)}
                    variant="filled"
                    InputProps={{ disableUnderline: true, sx: { borderRadius: '10px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' } }}
                  />
                  <TextField
                    size="small"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => updateCustomField(field.id, "value", e.target.value)}
                    variant="filled"
                    InputProps={{ disableUnderline: true, sx: { borderRadius: '10px', bgcolor: SURFACE_COLOR, border: '1px solid rgba(255,255,255,0.03)' } }}
                  />
                  <IconButton onClick={() => removeCustomField(field.id)} size="small" sx={{ color: 'rgba(239, 68, 68, 0.4)', '&:hover': { color: '#ef4444', bgcolor: alpha('#ef4444', 0.1) } }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              ))}
            </Grid>
          </Grid>

          {error && (
            <Typography color="error" variant="caption" sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha('#ef4444', 0.05), p: 1.5, borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </Typography>
          )}
        </Box>

        {/* Footer with Actions */}
        <Box sx={{ 
          p: 3, 
          pt: 2,
          gap: 2,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0,
          backgroundColor: isMobile ? 'transparent' : BG_COLOR
        }}>
          <Button 
            onClick={onClose} 
            fullWidth 
            variant="text"
            sx={{ 
              borderRadius: '14px', 
              py: 1.5, 
              fontWeight: 700, 
              color: 'rgba(255,255,255,0.4)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            fullWidth 
            variant="contained" 
            disabled={loading}
            startIcon={!loading && <SaveIcon sx={{ fontSize: 18 }} />}
            sx={{ 
              borderRadius: '14px', 
              py: 1.5, 
              fontWeight: 900,
              bgcolor: VAULT_PRIMARY,
              color: '#000',
              fontFamily: 'var(--font-space-grotesk)',
              boxShadow: `0 8px 25px ${alpha(VAULT_PRIMARY, 0.3)}`,
              '&:hover': { 
                bgcolor: '#0fa976',
                boxShadow: `0 12px 30px ${alpha(VAULT_PRIMARY, 0.4)}`,
                transform: 'translateY(-2px)'
              },
              '&:disabled': {
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.2)'
              },
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {loading ? "Saving..." : initial ? "Update" : "Add Credential"}
          </Button>
        </Box>
      </form>
    </Drawer>
  );
}
