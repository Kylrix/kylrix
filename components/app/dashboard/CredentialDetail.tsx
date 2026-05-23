import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  Drawer, 
  Divider, 
  alpha, 
  useTheme,
  Chip,
  Paper,
  Stack
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import GppGoodIcon from '@mui/icons-material/GppGood';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FolderIcon from '@mui/icons-material/Folder';
import ProjectLinker from '@/components/projects/ProjectLinker';
import type { Credentials } from '@/lib/appwrite/types';
import { storage } from '@/lib/appwrite';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';

export default function CredentialDetail({
  credential,
  onClose,
  isMobile,
}: {
  credential: Credentials;
  onClose: () => void;
  isMobile: boolean;
}) {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { requestSudo } = useSudo();

  const { analyze } = useAI();
  const [urlSafety, setUrlSafety] = useState<{ safe: boolean; riskLevel: string; reason: string } | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);

  const checkUrlSafety = useCallback(async (url: string) => {
    setCheckingUrl(true);
    try {
      const result = (await analyze('URL_SAFETY', { url })) as { safe: boolean; riskLevel: string; reason: string };
      if (result) {
        setUrlSafety(result);
      }
    } catch (e: unknown) {
      console.error("Failed to check URL safety", e);
    } finally {
      setCheckingUrl(false);
    }
  }, [analyze]);

  useEffect(() => {
    if (credential.url && !urlSafety && !checkingUrl) {
      checkUrlSafety(credential.url);
    }
  }, [credential.url, checkUrlSafety, checkingUrl, urlSafety]);

  if (!credential) return null;

  const handleCopy = (value: string, field: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  let customFields = [];
  try {
    if (credential.customFields) {
      customFields = JSON.parse(credential.customFields);
    }
  } catch {
    customFields = [];
  }

  let attachments = [];
  try {
    if (credential.attachments) {
      attachments = JSON.parse(credential.attachments);
    }
  } catch {
    attachments = [];
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getFaviconUrl = (url: string) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(credential.url || "");

  const FieldLabel = ({ label, onCopy, fieldId }: { label: string, onCopy?: () => void, fieldId?: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      {onCopy && (
        <Button 
          size="small" 
          onClick={onCopy} 
          startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
          sx={{ 
            height: 24, 
            fontSize: '0.7rem', 
            borderRadius: '6px',
            color: copied === fieldId ? 'success.main' : 'primary.main'
          }}
        >
          {copied === fieldId ? "Copied!" : "Copy"}
        </Button>
      )}
    </Box>
  );

  const FieldValue = ({ children, sx = {} }: { children: React.ReactNode, sx?: any }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '12px',
        bgcolor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: 'var(--font-satoshi-mono), monospace',
        fontSize: '0.9rem',
        wordBreak: 'break-all',
        ...sx
      }}
    >
      {children}
    </Paper>
  );

  return (
    <Drawer
      anchor="right"
      open={true}
      onClose={onClose}
      variant={isMobile ? "temporary" : "persistent"}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          {isMobile ? <ArrowBackIcon sx={{ fontSize: 20 }} /> : <CloseIcon sx={{ fontSize: 20 }} />}
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: '"Space Grotesk", sans-serif', flexGrow: 1 }}>
          Credential Details
        </Typography>
        <IconButton 
          size="small" 
          onClick={() => setShowProjectLinker(true)} 
          sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2) }}
        >
          <FolderIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={credential.$id} 
        entityKind="password" 
      />

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
        {/* Main Info Card */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 4 }}>
          <Box sx={{ 
            width: 64, 
            height: 64, 
            borderRadius: '18px', 
            bgcolor: 'rgba(255, 255, 255, 0.03)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden'
          }}>
            {faviconUrl ? (
              <Box component="img" src={faviconUrl} sx={{ width: 36, height: 36 }} />
            ) : (
              <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main' }}>
                {credential.name?.charAt(0)?.toUpperCase() || "?"}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
              {credential.name}
            </Typography>
            {credential.url && (
              <Stack direction="column" spacing={1} alignItems="flex-start">
                <Button 
                  href={credential.url} 
                  target="_blank" 
                  size="small"
                  startIcon={<LanguageIcon sx={{ fontSize: 14 }} />}
                  endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                  sx={{ 
                    p: 0, 
                    minWidth: 0, 
                    color: 'primary.main', 
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
                  }}
                >
                  {new URL(credential.url).hostname}
                </Button>
                {urlSafety && (
                  <Chip
                    icon={urlSafety.safe ? <GppGoodIcon sx={{ fontSize: 14 }} /> : <GppMaybeIcon sx={{ fontSize: 14 }} />}
                    label={`${urlSafety.riskLevel} Risk: ${urlSafety.reason}`}
                    size="small"
                    sx={{ 
                      bgcolor: urlSafety.safe ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                      color: urlSafety.safe ? 'success.main' : 'error.main',
                      border: `1px solid ${alpha(urlSafety.safe ? theme.palette.success.main : theme.palette.error.main, 0.2)}`,
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      textTransform: 'uppercase'
                    }}
                  />
                )}
              </Stack>
            )}
          </Box>
        </Box>

        <Stack spacing={3.5}>
          <Box>
            <FieldLabel label="Username / Email" onCopy={() => handleCopy(credential.username || '', "username")} fieldId="username" />
            <FieldValue>{credential.username || "N/A"}</FieldValue>
          </Box>

          {/* Secret */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Secret Value
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  onClick={() => {
                    if (!showPassword) {
                      requestSudo({ onSuccess: () => setShowPassword(true) });
                    } else {
                      setShowPassword(false);
                    }
                  }}
                  startIcon={showPassword ? <VisibilityOffIcon sx={{ fontSize: 12 }} /> : <VisibilityIcon sx={{ fontSize: 12 }} />}
                  sx={{ height: 24, fontSize: '0.7rem', borderRadius: '6px' }}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
                <Button 
                  size="small" 
                  onClick={() => requestSudo({ onSuccess: () => handleCopy(credential.password || '', "password") })}
                  startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                  sx={{ 
                    height: 24, 
                    fontSize: '0.7rem', 
                    borderRadius: '6px',
                    color: copied === "password" ? 'success.main' : 'primary.main'
                  }}
                >
                  {copied === "password" ? "Copied!" : "Copy"}
                </Button>
              </Box>
            </Box>
            <FieldValue sx={{ color: showPassword ? 'text.primary' : 'text.secondary', letterSpacing: showPassword ? 'normal' : '0.3em' }}>
              {credential.password ? (showPassword ? credential.password : "••••••••••••••••") : "N/A"}
            </FieldValue>
          </Box>

          {/* Notes */}
          {credential.notes && (
            <Box>
              <FieldLabel label="Notes" onCopy={() => handleCopy(credential.notes || "", "notes")} fieldId="notes" />
              <FieldValue sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {credential.notes}
              </FieldValue>
            </Box>
          )}

          {/* Tags */}
          {credential.tags && credential.tags.length > 0 && (
            <Box>
              <FieldLabel label="Tags" />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {credential.tags.map((tag: string, index: number) => (
                  <Chip 
                    key={index} 
                    label={tag} 
                    size="small" 
                    sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontWeight: 600
                    }} 
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Box>
              <FieldLabel label="Custom Fields" />
              <Stack spacing={2}>
                {customFields.map((field: { id?: string; label?: string; value?: string }, index: number) => (
                  <Box key={field.id || index}>
                    <FieldLabel 
                      label={field.label || `Field ${index + 1}`} 
                      onCopy={() => handleCopy(field.value || "", `custom-${index}`)} 
                      fieldId={`custom-${index}`} 
                    />
                    <FieldValue>{field.value || "Empty"}</FieldValue>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Secure Attachments */}
          {attachments.length > 0 && (
            <Box>
              <FieldLabel label="Secure Attachments" />
              <Stack spacing={2.5}>
                {attachments.map((att: any, index: number) => {
                  let fileUrl = "";
                  try {
                    const res = storage.getFileView('vault_attachments', att.id);
                    fileUrl = String(res);
                  } catch (err) {
                    console.error("Failed to generate preview URL:", err);
                  }

                  return (
                    <Box key={att.id || index} sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.06)', bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', wordBreak: 'break-all' }}>
                          {att.name}
                        </Typography>
                        <IconButton 
                          size="small" 
                          component="a" 
                          href={fileUrl} 
                          target="_blank"
                          sx={{ color: 'primary.main', p: 0.5, mt: -0.5 }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}>
                        {(att.size / 1024).toFixed(1)} KB • {att.mime || 'application/octet-stream'}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Metadata */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon sx={{ fontSize: 14 }} /> Information
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {credential.createdAt && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Created: <Box component="span" sx={{ color: 'text.primary' }}>{formatDate(credential.createdAt)}</Box>
                </Typography>
              )}
              {credential.updatedAt && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Updated: <Box component="span" sx={{ color: 'text.primary' }}>{formatDate(credential.updatedAt)}</Box>
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}
