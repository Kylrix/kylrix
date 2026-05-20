"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  alpha,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonIcon from '@mui/icons-material/Person';
import KeyIcon from '@mui/icons-material/VpnKey';
import ShareIcon from '@mui/icons-material/Share';
import SearchIcon from '@mui/icons-material/Search';
import { useAppwriteVault } from '@/context/appwrite-context';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { EcosystemSecurity } from '@/lib/ecosystem/security';
import {
  acceptSharedCredential,
  acceptSharedTotp,
  listAllCredentials,
  listIncomingKeyMappings,
  listTotpSecrets,
  shareCredential,
  shareTotpSecret,
} from '@/lib/appwrite';
import type { Credentials, KeyMapping, TotpSecrets } from '@/lib/appwrite/types';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Share2 } from 'lucide-react';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';

type SearchResult = Awaited<ReturnType<typeof searchGlobalUsers>>[number];

function parseMetadata(metadata: string | null) {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export default function SharingPage() {
  const router = useRouter();
  const { user, isVaultUnlocked } = useAppwriteVault();
  const [activeTab, setActiveTab] = useState(0);
  
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [totpSecrets, setTotpSecrets] = useState<TotpSecrets[]>([]);
  const [incomingShares, setIncomingShares] = useState<KeyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  
  // Share form states
  const [shareType, setShareType] = useState<"credential" | "totp">("credential");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [selectedTotpId, setSelectedTotpId] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<SearchResult[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<SearchResult | null>(null);

  // Detail drawer state
  const [selectedCredential, setSelectedCredential] = useState<Credentials | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!user?.$id || !isVaultUnlocked()) return;

    setLoading(true);
    EcosystemSecurity.getInstance().ensureE2EIdentity(user.$id)
      .then(() =>
        Promise.allSettled([
          listAllCredentials(user.$id),
          listTotpSecrets(user.$id),
          listIncomingKeyMappings(user.$id),
        ]),
      )
      .then(([credsResult, totpResult, shareResult]) => {
        if (credsResult.status === "fulfilled") setCredentials(credsResult.value);
        if (totpResult.status === "fulfilled") setTotpSecrets(totpResult.value);
        if (shareResult.status === "fulfilled") setIncomingShares(shareResult.value);
      })
      .catch((error: unknown) => {
        console.error("[sharing] failed to load data", error);
        toast.error("Unable to load sharing data.");
      })
      .finally(() => setLoading(false));
  }, [user, isVaultUnlocked]);

  useEffect(() => {
    if (!recipientQuery || recipientQuery.trim().length < 2) {
      setRecipientResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      searchGlobalUsers(recipientQuery.trim(), 8)
        .then(setRecipientResults)
        .catch((error: unknown) => {
          console.error("[sharing] user search failed", error);
          setRecipientResults([]);
        });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [recipientQuery]);

  const selectedSource = useMemo(() => {
    if (shareType === "credential") {
      return credentials.find((item) => item.$id === selectedCredentialId) ?? null;
    }
    return totpSecrets.find((item) => item.$id === selectedTotpId) ?? null;
  }, [credentials, selectedCredentialId, selectedTotpId, shareType, totpSecrets]);

  // Filter out normal credentials and only show accepted secrets shared by OTHERS
  const acceptedSharedCredentials = useMemo(() => {
    return credentials.filter(c => c.sharedFrom && c.sharedFrom !== user?.$id);
  }, [credentials, user?.$id]);

  // Filter KeyMappings to ONLY show those related to vault credentials or TOTPs (exclude chat huddle/conversation mappings)
  const pendingShares = useMemo(() => {
    return incomingShares.filter(
      (mapping) => mapping.resourceType === "credential" || mapping.resourceType === "totp"
    );
  }, [incomingShares]);

  const refreshData = async () => {
    if (!user?.$id) return;
    const [credsResult, totpResult, shareResult] = await Promise.allSettled([
      listAllCredentials(user.$id),
      listTotpSecrets(user.$id),
      listIncomingKeyMappings(user.$id),
    ]);

    if (credsResult.status === "fulfilled") setCredentials(credsResult.value);
    if (totpResult.status === "fulfilled") setTotpSecrets(totpResult.value);
    if (shareResult.status === "fulfilled") setIncomingShares(shareResult.value);
  };

  const handleShare = async () => {
    if (!selectedRecipient?.publicKey) {
      toast.error("Select a recipient with a secure key.");
      return;
    }

    setSharing(true);
    try {
      if (shareType === "credential") {
        if (!selectedCredentialId) throw new Error("Select a secret to share.");
        await shareCredential(selectedCredentialId, {
          userId: selectedRecipient.id,
          publicKey: selectedRecipient.publicKey,
        });
      } else {
        if (!selectedTotpId) throw new Error("Select a secret to share.");
        await shareTotpSecret(selectedTotpId, {
          userId: selectedRecipient.id,
          publicKey: selectedRecipient.publicKey,
        });
      }

      toast.success("Secret shared successfully.");
      setRecipientQuery("");
      setRecipientResults([]);
      setSelectedRecipient(null);
      setSelectedCredentialId("");
      setSelectedTotpId("");
      await refreshData();
      setActiveTab(0); // Switch to Shared with Me to view any update if needed
    } catch (error: unknown) {
      console.error("[sharing] share failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to share secret.");
    } finally {
      setSharing(false);
    }
  };

  const handleAccept = async (mapping: KeyMapping) => {
    setAcceptingId(mapping.$id);
    try {
      if (mapping.resourceType === "credential") {
        await acceptSharedCredential(mapping);
      } else if (mapping.resourceType === "totp") {
        await acceptSharedTotp(mapping);
      } else {
        throw new Error("Unsupported share type.");
      }

      toast.success("Shared secret added to your vault.");
      await refreshData();
    } catch (error: unknown) {
      console.error("[sharing] accept failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to accept secret.");
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      pb: 10,
      bgcolor: '#0A0908',
      pt: { xs: 2, md: 4 }
    }}>
      {/* Header Section */}
      <Box sx={{ px: { xs: 2, md: 6 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
          <IconButton 
            onClick={() => router.back()} 
            sx={{ 
              color: '#fff', 
              bgcolor: '#161412',
              border: '1px solid #1C1A18',
              '&:hover': { bgcolor: '#1C1A18' }
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
            Shared Secrets
          </Typography>
        </Stack>

        {/* Tab Selection */}
        <Box sx={{ 
          mb: 4, 
          bgcolor: 'rgba(255,255,255,0.03)', 
          borderRadius: 4, 
          p: 0.5,
          border: '1px solid rgba(255,255,255,0.05)',
          maxWidth: 600
        }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                borderRadius: 3.5,
                minHeight: 44,
                transition: 'all 0.2s',
                color: 'text.secondary',
                fontSize: '0.9rem',
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: '#10B981',
                  color: '#000',
                  fontWeight: 900,
                },
                '&:hover:not(.Mui-selected)': {
                  color: 'text.primary',
                  bgcolor: 'rgba(255,255,255,0.05)'
                }
              }
            }}
          >
            <Tab icon={<User size={18} />} iconPosition="start" label={`Shared with Me (${acceptedSharedCredentials.length + pendingShares.length})`} />
            <Tab icon={<Share2 size={18} />} iconPosition="start" label="Share a Secret" />
          </Tabs>
        </Box>

        {/* Content Area */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10, maxWidth: 600 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : activeTab === 0 ? (
          /* Shared with Me Tab */
          <Box sx={{ maxWidth: 600 }}>
            {pendingShares.length === 0 && acceptedSharedCredentials.length === 0 ? (
              <Paper elevation={0} sx={{ 
                p: 8, 
                textAlign: 'center', 
                borderRadius: '32px', 
                bgcolor: '#161412', 
                border: '1px dashed #1C1A18'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>
                  No Shared Secrets
                </Typography>
                <Typography sx={{ color: '#9B9691', maxWidth: 320, mx: 'auto' }}>
                  When others share secrets with you privately, they will appear here.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {/* Pending Incoming Shares */}
                {pendingShares.length > 0 && (
                  <Box>
                    <Typography 
                      variant="overline" 
                      sx={{ 
                        display: 'block',
                        fontWeight: 900, 
                        color: '#F59E0B', 
                        mb: 1.5, 
                        letterSpacing: '0.12em',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem'
                      }}
                    >
                      Pending Acceptance
                    </Typography>
                    <Stack spacing={1.5}>
                      {pendingShares.map((mapping) => {
                        const metadata = parseMetadata(mapping.metadata);
                        const label = String(metadata.sourceName ?? mapping.resourceId);
                        const sender = String(metadata.senderId ?? "unknown");
                        return (
                          <Paper
                            key={mapping.$id}
                            elevation={0}
                            sx={{
                              p: 2.5,
                              borderRadius: '24px',
                              border: "1px solid rgba(245, 158, 11, 0.15)",
                              bgcolor: alpha("#F59E0B", 0.02),
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 2,
                              alignItems: "center"
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 900, color: '#fff', fontFamily: 'var(--font-clash)', fontSize: '1rem' }} noWrap>
                                {label}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#9B9691", mt: 0.5, display: 'block', fontWeight: 500 }}>
                                Shared by {sender}
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<LockOpenIcon sx={{ fontSize: 16 }} />}
                              onClick={() => handleAccept(mapping)}
                              disabled={acceptingId === mapping.$id}
                              sx={{ 
                                borderRadius: '12px',
                                color: '#F59E0B',
                                borderColor: 'rgba(245, 158, 11, 0.3)',
                                fontWeight: 800,
                                textTransform: 'none',
                                '&:hover': {
                                  borderColor: '#F59E0B',
                                  bgcolor: alpha('#F59E0B', 0.05)
                                }
                              }}
                            >
                              {acceptingId === mapping.$id ? "Unwrapping..." : "Unwrap"}
                            </Button>
                          </Paper>
                        );
                      })}
                    </Stack>
                    <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.05)' }} />
                  </Box>
                )}

                {/* Accepted Secrets */}
                {acceptedSharedCredentials.length > 0 && (
                  <Box>
                    <Typography 
                      variant="overline" 
                      sx={{ 
                        display: 'block',
                        fontWeight: 900, 
                        color: '#10B981', 
                        mb: 1.5, 
                        letterSpacing: '0.12em',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem'
                      }}
                    >
                      Accepted Secrets
                    </Typography>
                    <Stack spacing={1.5}>
                      {acceptedSharedCredentials.map((cred: Credentials) => (
                        <CredentialItem
                          key={cred.$id}
                          credential={cred}
                          onCopy={handleCopy}
                          onEdit={() => {}} // Read-only received secrets
                          onDelete={() => {}} 
                          onClick={() => {
                            setSelectedCredential(cred);
                            setShowDetail(true);
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        ) : (
          /* Share a Secret Tab */
          <Box sx={{ maxWidth: 600 }}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: '32px',
                border: "1px solid #1C1A18",
                bgcolor: '#161412',
                backgroundImage: 'none'
              }}
            >
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                  <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#10B981', 0.1), color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex' }}>
                    <ShareIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                    Share Securely
                  </Typography>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Secret Type"
                    value={shareType}
                    onChange={(e) => setShareType(e.target.value as "credential" | "totp")}
                    SelectProps={{ native: true }}
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      sx: { borderRadius: '12px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
                  >
                    <option value="credential">Vault Secret</option>
                    <option value="totp">One-Time Code (TOTP)</option>
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    label={shareType === "credential" ? "Select Secret" : "Select TOTP"}
                    value={shareType === "credential" ? selectedCredentialId : selectedTotpId}
                    onChange={(e) =>
                      shareType === "credential"
                        ? setSelectedCredentialId(e.target.value)
                        : setSelectedTotpId(e.target.value)
                    }
                    SelectProps={{ native: true }}
                    variant="filled"
                    InputProps={{
                      disableUnderline: true,
                      sx: { borderRadius: '12px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.03)' }
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
                  >
                    <option value="">Select one...</option>
                    {shareType === "credential"
                      ? credentials.filter(c => !c.sharedFrom).map((credential) => (
                          <option key={credential.$id} value={credential.$id}>
                            {credential.name}
                          </option>
                        ))
                      : totpSecrets.map((secret) => (
                          <option key={secret.$id} value={secret.$id}>
                            {secret.issuer} / {secret.accountName}
                          </option>
                        ))}
                  </TextField>
                </Stack>

                <TextField
                  fullWidth
                  label="Find Recipient"
                  placeholder="Type username or display name"
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  variant="filled"
                  InputProps={{
                    disableUnderline: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: '12px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.03)' }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
                />

                {recipientResults.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {recipientResults.map((result) => (
                      <Paper
                        key={result.id}
                        elevation={0}
                        onClick={() => setSelectedRecipient(result)}
                        sx={{
                          p: 2,
                          cursor: "pointer",
                          borderRadius: '16px',
                          border: "1px solid",
                          borderColor:
                            selectedRecipient?.id === result.id
                              ? "rgba(16,185,129,0.3)"
                              : "rgba(255,255,255,0.03)",
                          bgcolor:
                            selectedRecipient?.id === result.id
                              ? "rgba(16,185,129,0.05)"
                              : "#0A0908",
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: 'center' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }} noWrap>
                              {result.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#9B9691", mt: 0.5, display: 'block' }}>
                              {result.subtitle}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={result.publicKey ? "Secure" : "No key"}
                            color={result.publicKey ? "success" : "default"}
                            variant="outlined"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              borderColor: result.publicKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)',
                              color: result.publicKey ? '#10B981' : '#9B9691'
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                )}

                <Button
                  variant="contained"
                  startIcon={<KeyIcon sx={{ fontSize: 16 }} />}
                  onClick={handleShare}
                  disabled={sharing || !selectedSource || !selectedRecipient?.publicKey}
                  sx={{ 
                    alignSelf: "flex-start", 
                    px: 4, 
                    py: 1.5, 
                    borderRadius: '16px',
                    fontWeight: 900,
                    bgcolor: '#10B981',
                    color: '#000',
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    '&:hover': { bgcolor: '#059669' },
                    transition: 'all 0.2s ease',
                    boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)'
                  }}
                >
                  {sharing ? "Sharing..." : "Share Securely"}
                </Button>
              </Stack>
            </Paper>
          </Box>
        )}
      </Box>

      {showDetail && selectedCredential && (
        <CredentialDetail
          credential={selectedCredential}
          onClose={() => setShowDetail(false)}
          isMobile={false}
        />
      )}
    </Box>
  );
}
