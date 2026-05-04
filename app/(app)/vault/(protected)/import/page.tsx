"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  alpha,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import ShieldIcon from "@mui/icons-material/Shield";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FolderIcon from "@mui/icons-material/Folder";
import { useAppwriteVault } from "@/context/appwrite-context";
import { validateBitwardenExport } from "@/utils/import/bitwarden-mapper";
import { useBackgroundTask } from '@/context/BackgroundTaskContext";
import { ImportPreviewModal } from "@/components/import/ImportPreviewModal";
import { ImportItem } from "@/lib/import/deduplication";
import { analyzeBitwardenExport } from "@/utils/import/bitwarden-mapper";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { porterExport, downloadExportAsFile } from "@/lib/data-porter";
import toast from "react-hot-toast";

export default function ImportPage() {
  const { user } = useAppwriteVault();
  const { startImport, isImporting: globalImporting } = useBackgroundTask();
  const [importType, setImportType] = useState<string>("bitwarden");
  const [file, setFile] = useState<File | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<ImportItem[]>([]);

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const result = await porterExport(user.$id);
      downloadExportAsFile(result.data);
      toast.success(`Exported ${result.data.credentials.length} credentials, ${result.data.totpSecrets.length} TOTP secrets`);
    } catch (err: unknown) {
      console.error('Export failed:', err);
      toast.error('Export failed: ' + ((err as Error).message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setErrorState(null);
  };

  const parseAndPreview = async (file: File) => {
    try {
      const text = await file.text();
      let items: ImportItem[] = [];

      if (importType === "bitwarden") {
        const data = JSON.parse(text);
        if (!validateBitwardenExport(data)) throw new Error("Invalid Bitwarden format");
        const mapped = analyzeBitwardenExport(data, user?.$id || "");
        items = mapped.credentials.map(c => ({
          ...c,
          _status: 'new'
        }));
      } else if (importType === "kylrixvault") {
        const data = JSON.parse(text);
        if (!data.version && !data.credentials) throw new Error("Invalid Kylrix Vault format");
        items = (data.credentials || []).map((c: unknown) => ({
          ...(c as Partial<ImportItem>),
          _status: 'new'
        }));
      } else {
        throw new Error("Preview not supported for this format yet");
      }

      if (items.length === 0) {
        throw new Error("No items found in file");
      }

      setPreviewItems(items);
      setIsPreviewOpen(true);
    } catch (error: unknown) {
      throw error;
    }
  };

  const handleImportClick = async () => {
    if (!user) {
      setErrorState("You must be logged in to import data.");
      return;
    }
    if (!file) {
      setErrorState("Please select a file to import.");
      return;
    }
    if (globalImporting) {
      setErrorState("An import is already in progress.");
      return;
    }
    setErrorState(null);
    try {
      await parseAndPreview(file);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Import failed.";
      setErrorState(errorMessage);
    }
  };

  const handleFinalImport = (finalItems: ImportItem[]) => {
    if (!masterPassCrypto.isVaultUnlocked()) {
      setErrorState("Vault is locked. Please unlock your vault to import.");
      setIsPreviewOpen(false);
      return;
    }
    setIsPreviewOpen(false);
    const processedPayload = JSON.stringify({
      version: 1,
      credentials: finalItems,
      folders: [],
      totpSecrets: []
    });
    startImport("kylrixvault", processedPayload, user!.$id);
  };

  const isFileValid =
    file &&
    ((importType === "bitwarden" && file.name.endsWith(".json")) ||
      (importType === "kylrixvault" && file.name.endsWith(".json")) ||
      (importType === "json" && file.name.endsWith(".json")) ||
      (!["bitwarden", "json", "kylrixvault"].includes(importType) &&
        file.name.endsWith(".csv")));

  return (
    <Box sx={{ maxWidth: '1100px', mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" sx={{
          fontWeight: 900,
          fontFamily: 'var(--font-space-grotesk)',
          letterSpacing: '-0.03em',
          mb: 1
        }}>
          Import Data
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
          Migrate your passwords and data from other password managers securely.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            <Paper sx={{
              p: 4,
              borderRadius: '28px',
              bgcolor: 'rgba(10, 10, 10, 0.9)',
              backdropFilter: 'blur(25px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundImage: 'none'
            }}>
              <Stack spacing={4}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Source Manager
                  </Typography>
                  <ToggleButtonGroup
                    value={importType}
                    exclusive
                    onChange={(_, val) => val && setImportType(val)}
                    sx={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1.5,
                      '& .MuiToggleButton-root': {
                        borderRadius: '14px !important',
                        py: 1.5,
                        border: '1px solid rgba(255, 255, 255, 0.1) !important',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontWeight: 700,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366F1',
                          borderColor: '#6366F1 !important',
                        }
                      }
                    }}
                  >
                    <ToggleButton value="bitwarden">Bitwarden</ToggleButton>
                    <ToggleButton value="kylrixvault">Kylrix Vault</ToggleButton>
                    <ToggleButton value="zoho" disabled>Zoho Vault</ToggleButton>
                    <ToggleButton value="proton" disabled>Proton Pass</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{
                  p: 3,
                  borderRadius: '20px',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
                    <InfoIcon sx={{ fontSize: 20, color: "#6366F1" }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {importType === "bitwarden" ? "How to export from Bitwarden" : "Restoring from Kylrix Note"}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.6 }}>
                    {importType === "bitwarden" ? (
                      "Log into your Bitwarden web vault, go to Tools → Export Vault, select JSON format, and download the file."
                    ) : (
                      "Upload a JSON backup file previously exported from Kylrix Note or Kylrix Vault."
                    )}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Select File
                  </Typography>
                  <Box
                    component="label"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 4,
                      borderRadius: '20px',
                      border: '2px dashed rgba(255, 255, 255, 0.1)',
                      bgcolor: 'rgba(255, 255, 255, 0.01)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(99, 102, 241, 0.3)'
                      }
                    }}
                  >
                    <input type="file" hidden onChange={handleFileChange} accept=".json" />
                    <UploadIcon sx={{ fontSize: 32, color: "rgba(255, 255, 255, 0.2)", mb: 1.5 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {file ? file.name : "Click to upload or drag and drop"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : "JSON files only"}
                    </Typography>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleImportClick}
                  disabled={globalImporting || !isFileValid}
                  sx={{
                    borderRadius: '16px',
                    py: 2,
                    fontWeight: 800,
                    bgcolor: '#6366F1',
                    color: '#000',
                    '&:hover': { bgcolor: '#00D1DA' },
                    '&.Mui-disabled': { bgcolor: 'rgba(99, 102, 241, 0.3)' }
                  }}
                >
                  {globalImporting ? "Import in Progress..." : "Preview & Import"}
                </Button>

                {errorState && (
                  <Alert severity="error" sx={{ borderRadius: '16px', bgcolor: alpha('#f44336', 0.1), color: '#ffcdd2' }}>
                    {errorState}
                  </Alert>
                )}
              </Stack>
            </Paper>

            {!globalImporting && (
              <Paper sx={{
                p: 3,
                borderRadius: '24px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <ErrorOutlineIcon sx={{ fontSize: 18, color: "#FFB000" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Important Notes</Typography>
                </Stack>
                <Stack spacing={1}>
                  {[
                    "Please stay connected to the internet during import.",
                    "A floating widget will show real-time progress.",
                    "Your data is encrypted locally with your master password.",
                    "Folders and organization will be preserved."
                  ].map((note, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.3)', mt: 1 }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>{note}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>

          {/* Export Section */}
          <Paper sx={{
            p: 4,
            borderRadius: '28px',
            bgcolor: 'rgba(10, 10, 10, 0.9)',
            backdropFilter: 'blur(25px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none'
          }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', mb: 1 }}>
                  Export Vault
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                  Download all your vault data as a Kylrix Vault JSON file. This export can be re-imported into any Kylrix instance.
                </Typography>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleExport}
                disabled={isExporting || !user}
                startIcon={<DownloadIcon />}
                sx={{
                  borderRadius: '16px',
                  py: 2,
                  fontWeight: 800,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  '&:hover': { borderColor: '#6366F1', bgcolor: 'rgba(99, 102, 241, 0.05)' },
                  '&.Mui-disabled': { borderColor: 'rgba(255, 255, 255, 0.05)' }
                }}
              >
                {isExporting ? 'Exporting...' : 'Export as Kylrix Vault JSON'}
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{
            p: 4,
            borderRadius: '28px',
            bgcolor: 'rgba(10, 10, 10, 0.9)',
            backdropFilter: 'blur(25px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            height: '100%'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, fontFamily: 'var(--font-space-grotesk)' }}>
              What gets imported?
            </Typography>
            <List sx={{ p: 0 }}>
              {[
                { title: "Login Credentials", desc: "Usernames, passwords, URLs, and notes", icon: VpnKeyIcon },
                { title: "TOTP Secrets", desc: "Two-factor authentication codes", icon: ShieldIcon },
                { title: "Folders", desc: "Your existing organization structure", icon: FolderIcon },
                { title: "Custom Fields", desc: "Additional metadata and fields", icon: DescriptionIcon }
              ].map((item, i) => (
                <ListItem key={i} sx={{ px: 0, py: 2.5 }}>
                  <ListItemIcon sx={{ minWidth: 48 }}>
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: 'rgba(99, 102, 241, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <item.icon sx={{ fontSize: 18, color: "#6366F1" }} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 800 }}>{item.title}</Typography>}
                    secondary={<Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>{item.desc}</Typography>}
                  />
                  <CheckCircleIcon sx={{ fontSize: 16, color: "#10B981" }} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      <ImportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        rawItems={previewItems}
        onConfirm={handleFinalImport}
      />
    </Box>
  );
}
