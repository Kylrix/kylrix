"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import DownloadDoneIcon from "@mui/icons-material/DownloadDone";
import SearchIcon from "@mui/icons-material/Search";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PersonIcon from "@mui/icons-material/Person";
import KeyIcon from "@mui/icons-material/VpnKey";
import VaultGuard from "@/components/layout/VaultGuard";
import { useAppwriteVault } from "@/context/appwrite-context";
import { searchGlobalUsers } from "@/lib/ecosystem/identity";
import { EcosystemSecurity } from "@/lib/ecosystem/security";
import {
  acceptSharedCredential,
  acceptSharedTotp,
  listAllCredentials,
  listIncomingKeyMappings,
  listTotpSecrets,
  shareCredential,
  shareTotpSecret,
} from "@/lib/appwrite";
import type { Credentials, KeyMapping, TotpSecrets } from "@/lib/appwrite/types";
import toast from "react-hot-toast";

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
  const { user, isVaultUnlocked } = useAppwriteVault();
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [totpSecrets, setTotpSecrets] = useState<TotpSecrets[]>([]);
  const [incomingShares, setIncomingShares] = useState<KeyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [shareType, setShareType] = useState<"credential" | "totp">("credential");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [selectedTotpId, setSelectedTotpId] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<SearchResult[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<SearchResult | null>(null);

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
      toast.error("Select a recipient with a public key.");
      return;
    }

    setSharing(true);
    try {
      if (shareType === "credential") {
        if (!selectedCredentialId) throw new Error("Select a credential to share.");
        await shareCredential(selectedCredentialId, {
          userId: selectedRecipient.id,
          publicKey: selectedRecipient.publicKey,
        });
      } else {
        if (!selectedTotpId) throw new Error("Select a TOTP secret to share.");
        await shareTotpSecret(selectedTotpId, {
          userId: selectedRecipient.id,
          publicKey: selectedRecipient.publicKey,
        });
      }

      toast.success("Share sent.");
      setRecipientQuery("");
      setRecipientResults([]);
      setSelectedRecipient(null);
      await refreshData();
    } catch (error: unknown) {
      console.error("[sharing] share failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to share item.");
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

      toast.success("Shared item added to your vault.");
      await refreshData();
    } catch (error: unknown) {
      console.error("[sharing] accept failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to accept share.");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <VaultGuard>
      <Box sx={{ width: "100%", p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
              Sharing Center
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, maxWidth: 760 }}>
              Wrap a credential or TOTP for a recipient, then let them unwrap it into their own vault copy.
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: alpha("#161412", 0.96),
            }}
          >
            <Stack spacing={2.5}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <ShareIcon sx={{ color: "#10B981" }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Send a share
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Share type"
                  value={shareType}
                  onChange={(e) => setShareType(e.target.value as "credential" | "totp")}
                  SelectProps={{ native: true }}
                >
                  <option value="credential">Credential</option>
                  <option value="totp">TOTP secret</option>
                </TextField>

                <TextField
                  select
                  fullWidth
                  label={shareType === "credential" ? "Credential" : "TOTP secret"}
                  value={shareType === "credential" ? selectedCredentialId : selectedTotpId}
                  onChange={(e) =>
                    shareType === "credential"
                      ? setSelectedCredentialId(e.target.value)
                      : setSelectedTotpId(e.target.value)
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="">Select one</option>
                  {shareType === "credential"
                    ? credentials.map((credential) => (
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
                label="Find recipient"
                placeholder="Search username or display name"
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {recipientResults.length > 0 && (
                <Stack spacing={1}>
                  {recipientResults.map((result) => (
                    <Paper
                      key={result.id}
                      elevation={0}
                      onClick={() => setSelectedRecipient(result)}
                      sx={{
                        p: 1.5,
                        cursor: "pointer",
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor:
                          selectedRecipient?.id === result.id
                            ? "rgba(16,185,129,0.5)"
                            : "rgba(255,255,255,0.08)",
                        bgcolor:
                          selectedRecipient?.id === result.id
                            ? "rgba(16,185,129,0.08)"
                            : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {result.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {result.subtitle}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={result.publicKey ? "Public key ready" : "No key"}
                          color={result.publicKey ? "success" : "default"}
                          variant="outlined"
                        />
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}

              <Button
                variant="contained"
                startIcon={<KeyIcon />}
                onClick={handleShare}
                disabled={sharing || !selectedSource || !selectedRecipient?.publicKey}
                sx={{ alignSelf: "flex-start", px: 3, py: 1.25, borderRadius: 999 }}
              >
                {sharing ? "Sharing..." : "Share securely"}
              </Button>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: alpha("#161412", 0.96),
            }}
          >
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <DownloadDoneIcon sx={{ color: "#6366F1" }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Incoming shares
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              {loading ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Loading sharing state...
                </Typography>
              ) : incomingShares.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: "rgba(255,255,255,0.03)" }}>
                  No incoming shares yet.
                </Alert>
              ) : (
                <Stack spacing={1.5}>
                  {incomingShares.map((mapping) => {
                    const metadata = parseMetadata(mapping.metadata);
                    const label = String(metadata.sourceName ?? mapping.resourceId);
                    const sender = String(metadata.senderId ?? "unknown");
                    return (
                      <Paper
                        key={mapping.$id}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.08)",
                          bgcolor: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800 }} noWrap>
                              {label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              Shared by {sender} • {mapping.resourceType}
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LockOpenIcon />}
                            onClick={() => handleAccept(mapping)}
                            disabled={acceptingId === mapping.$id}
                            sx={{ borderRadius: 999 }}
                          >
                            {acceptingId === mapping.$id ? "Adding..." : "Accept"}
                          </Button>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: alpha("#161412", 0.96),
            }}
          >
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <PersonIcon sx={{ color: "#10B981" }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Your shareable items
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.02)" }}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Credentials</Typography>
                  <Stack spacing={1}>
                    {credentials.map((credential) => (
                      <Box key={credential.$id} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                          {credential.name}
                        </Typography>
                        {credential.sharedFrom ? (
                          <Chip size="small" label={`shared from ${credential.sharedFrom}`} variant="outlined" />
                        ) : (
                          <Chip size="small" label="owned" color="success" variant="outlined" />
                        )}
                      </Box>
                    ))}
                    {credentials.length === 0 && (
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        No credentials yet.
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.02)" }}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>TOTP secrets</Typography>
                  <Stack spacing={1}>
                    {totpSecrets.map((secret) => (
                      <Box key={secret.$id} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                          {secret.issuer} / {secret.accountName}
                        </Typography>
                        {secret.sharedFrom ? (
                          <Chip size="small" label={`shared from ${secret.sharedFrom}`} variant="outlined" />
                        ) : (
                          <Chip size="small" label="owned" color="success" variant="outlined" />
                        )}
                      </Box>
                    ))}
                    {totpSecrets.length === 0 && (
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        No TOTP secrets yet.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </VaultGuard>
  );
}
