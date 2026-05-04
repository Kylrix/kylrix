"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Paper, 
  TextField, 
  IconButton, 
  Stack, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  InputAdornment, 
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import FolderIcon from "@mui/icons-material/Folder";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useAppwriteVault } from "@/context/appwrite-context";
import {
  createCredential,
  createFolder,
  createTotpSecret,
  listFolders,
} from "@/lib/appwrite";
import type { Folders, Credentials, TotpSecrets } from "@/lib/appwrite/types";
import { generateRandomPassword } from "@/utils/password";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import toast from "react-hot-toast";
import VaultGuard from "@/components/layout/VaultGuard";

export default function NewCredentialPage() {
  const router = useRouter();
  const { user } = useAppwriteVault();
  const [showPassword, setShowPassword] = useState(false);
  const [customFields, setCustomFields] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [folders, setFolders] = useState<Folders[]>([]);
  const [formData, setFormData] = useState({
    type: "credential" as "credential" | "folder" | "totp",
    name: "",
    url: "",
    username: "",
    password: "",
    notes: "",
    folder: "",
    tags: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.$id) {
      listFolders(user.$id)
        .then(setFolders)
        .catch(() => {
          toast.error("Could not load folders.");
        });
    }
  }, [user]);

  const handleGeneratePassword = () => {
    setFormData({ ...formData, password: generateRandomPassword(16) });
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
    setLoading(true);

    try {
      if (!user?.$id) {
        throw new Error("Not authenticated");
      }

      if (!masterPassCrypto.isVaultUnlocked()) {
        throw new Error("Vault is locked. Please unlock your vault first.");
      }

      if (formData.type === "credential") {
        const credentialData: Pick<
          Credentials,
          | "userId"
          | "itemType"
          | "name"
          | "url"
          | "username"
          | "notes"
          | "folderId"
          | "tags"
          | "customFields"
          | "faviconUrl"
          | "isFavorite"
          | "isDeleted"
          | "createdAt"
          | "updatedAt"
          | "password"
        > = {
          userId: user.$id,
          itemType: "login",
          name: formData.name.trim(),
          url: null,
          username: formData.username.trim(),
          notes: null,
          folderId: null,
          tags: null,
          customFields: null,
          faviconUrl: null,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          password: formData.password.trim(),
        };
        if (formData.url && formData.url.trim())
          credentialData.url = formData.url.trim();
        if (formData.notes && formData.notes.trim())
          credentialData.notes = formData.notes.trim();
        if (formData.folder && formData.folder.trim())
          credentialData.folderId = formData.folder.trim();
        if (formData.tags && formData.tags.trim()) {
          const tagsArr = formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          if (tagsArr.length > 0) credentialData.tags = tagsArr;
        }
        if (customFields.length > 0)
          credentialData.customFields = JSON.stringify(customFields);

        await createCredential(
          credentialData as Omit<
            Credentials,
            "$id" | "$createdAt" | "$updatedAt"
          >,
        );
        toast.success("Credential created!");
        router.push("/dashboard");
      } else if (formData.type === "folder") {
        await createFolder({
          userId: user.$id,
          name: formData.name,
          parentFolderId: null,
          icon: null,
          color: null,
          sortOrder: 0,
          isDeleted: false,
          deletedAt: null,
        } as unknown as Omit<Folders, "$id" | "$createdAt" | "$updatedAt">);
        toast.success("Folder created!");
        router.push("/dashboard");
      } else if (formData.type === "totp") {
        if (!masterPassCrypto.isVaultUnlocked()) {
          throw new Error("Vault is locked. Please unlock your vault first.");
        }

        await createTotpSecret({
          userId: user.$id,
          issuer: formData.name,
          accountName: formData.username,
          secretKey: formData.password,
          folderId: formData.folder || null,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          url: null,
          tags: null,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Omit<TotpSecrets, "$id" | "$createdAt" | "$updatedAt">);
        toast.success("TOTP code added!");
        router.push("/totp");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to save. Please check if your vault is unlocked.";
      toast.error(message);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <VaultGuard>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: '#6366F1' }} />
        </Box>
      </VaultGuard>
    );
  }

  return (
    <Box sx={{ maxWidth: '800px', mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <IconButton 
          onClick={() => router.back()}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Box>
          <Typography variant="h4" sx={{ 
            fontWeight: 900, 
            fontFamily: 'var(--font-space-grotesk)',
            letterSpacing: '-0.02em'
          }}>
            {formData.type === "credential" ? "Add Credential" : "Add Folder"}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
            {formData.type === "credential"
              ? "Store a new password securely in your vault"
              : "Organize your credentials with folders"}
          </Typography>
        </Box>
      </Stack>

      <Paper sx={{ 
        p: 4, 
        borderRadius: '28px', 
        bgcolor: 'rgba(10, 10, 10, 0.9)',
        backdropFilter: 'blur(25px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundImage: 'none'
      }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={4}>
            {/* Type Switcher */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Item Type
              </Typography>
              <ToggleButtonGroup
                value={formData.type}
                exclusive
                onChange={(_, val) => val && setFormData(f => ({ ...f, type: val }))}
                sx={{ 
                  width: '100%',
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    borderRadius: '14px',
                    py: 1.5,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: 700,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(99, 102, 241, 0.1)',
                      color: '#6366F1',
                      borderColor: '#6366F1',
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' }
                    }
                  }
                }}
              >
                <ToggleButton value="credential">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <VpnKeyIcon sx={{ fontSize: 18 }} />
                    <span>Password</span>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="folder">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FolderIcon sx={{ fontSize: 18 }} />
                    <span>Folder</span>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {formData.type === "credential" ? (
              <>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Name"
                      placeholder="e.g., GitHub, Gmail"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                        }
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Website URL"
                      type="url"
                      placeholder="https://example.com"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                        }
                      }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  label="Username/Email"
                  placeholder="john@example.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                    }
                  }}
                />

                <Box>
                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter or generate password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    variant="outlined"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOffIcon sx={{ fontSize: 20 }} /> : <VisibilityIcon sx={{ fontSize: 20 }} />}
                          </IconButton>
                          <IconButton onClick={handleGeneratePassword} edge="end" sx={{ ml: 1 }}>
                            <RefreshIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                      }
                    }}
                  />
                </Box>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Folder</InputLabel>
                      <Select
                        value={formData.folder}
                        onChange={(e) => setFormData({ ...formData, folder: e.target.value as string })}
                        label="Folder"
                        sx={{
                          borderRadius: '16px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <MenuItem value="">No Folder</MenuItem>
                        {folders.map((folder) => (
                          <MenuItem key={folder.$id} value={folder.$id}>
                            {folder.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Tags"
                      placeholder="work, email, important"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                        }
                      }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  placeholder="Additional notes or information"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                    }
                  }}
                />

                {/* Custom Fields */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Custom Fields</Typography>
                    <Button 
                      size="small" 
                      startIcon={<AddIcon sx={{ fontSize: 16 }} />} 
                      onClick={addCustomField}
                      sx={{ color: '#6366F1', fontWeight: 700 }}
                    >
                      Add Field
                    </Button>
                  </Stack>
                  <Stack spacing={2}>
                    {customFields.map((field) => (
                      <Stack key={field.id} direction="row" spacing={2}>
                        <TextField
                          fullWidth
                          placeholder="Field name"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.id, "label", e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.02)' } }}
                        />
                        <TextField
                          fullWidth
                          placeholder="Field value"
                          value={field.value}
                          onChange={(e) => updateCustomField(field.id, "value", e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.02)' } }}
                        />
                        <IconButton onClick={() => removeCustomField(field.id)} sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                          <CloseIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </>
            ) : (
              <TextField
                fullWidth
                label="Folder Name"
                placeholder="e.g., Work, Personal"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button 
                variant="text" 
                onClick={() => router.back()}
                sx={{ 
                  borderRadius: '14px', 
                  px: 4, 
                  py: 1.5, 
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.5)'
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading}
                sx={{ 
                  borderRadius: '14px', 
                  px: 6, 
                  py: 1.5, 
                  fontWeight: 800,
                  bgcolor: '#6366F1',
                  color: '#000',
                  '&:hover': { bgcolor: '#00D1DA' },
                  '&.Mui-disabled': { bgcolor: 'rgba(99, 102, 241, 0.3)' }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : (formData.type === "credential" ? "Save Credential" : "Save Folder")}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
