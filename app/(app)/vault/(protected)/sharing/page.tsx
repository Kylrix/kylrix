"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, User, Share2, Unlock, Key, Search } from 'lucide-react';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import { MultiSectionContainer } from '@/context/SectionContext';

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
          listIncomingKeyMappings(user.$id)]),
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

  // Filter KeyMappings to ONLY show those related to vault credentials or TOTPs (exclude huddle/conversation mappings)
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
      listIncomingKeyMappings(user.$id)]);

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
      setActiveTab(0); // Switch to Shared with Me to view any update
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
    <div className="flex flex-col min-h-screen pb-10 bg-[#0A0908] pt-4 md:pt-8">
      <MultiSectionContainer panels={['secrets', 'totp', 'secret_chat']}>
      {/* Header Section */}
      <div className="px-4 md:px-12">
        <div className="flex items-center gap-3.5 mb-8">
          <button 
            onClick={() => router.back()} 
            className="p-2 text-white bg-[#161412] border border-[#1C1A18] rounded-xl hover:bg-[#1C1A18] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black font-clash text-white">
            Shared Secrets
          </h1>
        </div>

        {/* Tab Selection */}
        <div className="mb-8 bg-white/3 rounded-2xl p-1 border border-white/5 max-w-[600px] flex gap-1">
          <button
            onClick={() => setActiveTab(0)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 0
                ? 'bg-[#10B981] text-black font-black'
                : 'text-[#9B9691] hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={18} />
            Shared with Me ({acceptedSharedCredentials.length + pendingShares.length})
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 1
                ? 'bg-[#10B981] text-black font-black'
                : 'text-[#9B9691] hover:text-white hover:bg-white/5'
            }`}
          >
            <Share2 size={18} />
            Share a Secret
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center py-24 max-w-[600px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : activeTab === 0 ? (
          /* Shared with Me Tab */
          <div className="max-w-[600px]">
            {pendingShares.length === 0 && acceptedSharedCredentials.length === 0 ? (
              <div className="p-24 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18]">
                <h2 className="text-xl font-black text-white mb-2 font-clash">
                  No Shared Secrets
                </h2>
                <p className="text-[#9B9691] max-w-xs mx-auto">
                  When others share secrets with you privately, they will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Pending Incoming Shares */}
                {pendingShares.length > 0 && (
                  <div>
                    <span className="block font-black text-amber-500 mb-3.5 tracking-[0.12em] font-mono text-[0.7rem] uppercase">
                      Pending Acceptance
                    </span>
                    <div className="flex flex-col gap-3.5">
                      {pendingShares.map((mapping) => {
                        const metadata = parseMetadata(mapping.metadata);
                        const label = String(metadata.sourceName ?? mapping.resourceId);
                        const sender = String(metadata.senderId ?? "unknown");
                        return (
                          <div
                            key={mapping.$id}
                            className="p-5 rounded-3xl border border-amber-500/15 bg-amber-500/[0.02] flex justify-between gap-4 items-center"
                          >
                            <div className="min-w-0 flex-1">
                              <h3 className="font-extrabold text-white font-clash text-base truncate">
                                {label}
                              </h3>
                              <span className="text-xs text-[#9B9691] mt-1 block font-medium">
                                Shared by {sender}
                              </span>
                            </div>
                            <button
                              onClick={() => handleAccept(mapping)}
                              disabled={acceptingId === mapping.$id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-500/30 text-amber-500 font-extrabold rounded-xl hover:border-amber-500 hover:bg-amber-500/5 transition-colors disabled:opacity-50 text-sm flex-shrink-0"
                            >
                              <Unlock size={16} />
                              {acceptingId === mapping.$id ? "Unwrapping..." : "Unwrap"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Accepted Secrets */}
                {acceptedSharedCredentials.length > 0 && (
                  <div>
                    <span className="block font-black text-emerald-500 mb-3.5 tracking-[0.12em] font-mono text-[0.7rem] uppercase">
                      Accepted Secrets
                    </span>
                    <div className="flex flex-col gap-3.5">
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
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Share a Secret Tab */
          <div className="max-w-[600px]">
            <div className="p-6 rounded-[32px] border border-[#1C1A18] bg-[#161412] shadow-none">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3.5 mb-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex">
                    <Share2 size={20} />
                  </div>
                  <h2 className="text-xl font-black font-clash text-white">
                    Share Securely
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs text-white/40 font-semibold px-1">Secret Type</label>
                    <select
                      value={shareType}
                      onChange={(e) => setShareType(e.target.value as "credential" | "totp")}
                      className="w-full h-12 px-4 rounded-xl bg-[#0A0908] border border-white/5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="credential">Vault Secret</option>
                      <option value="totp">One-Time Code (TOTP)</option>
                    </select>
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs text-white/40 font-semibold px-1">
                      {shareType === "credential" ? "Select Secret" : "Select TOTP"}
                    </label>
                    <select
                      value={shareType === "credential" ? selectedCredentialId : selectedTotpId}
                      onChange={(e) =>
                        shareType === "credential"
                          ? setSelectedCredentialId(e.target.value)
                          : setSelectedTotpId(e.target.value)
                      }
                      className="w-full h-12 px-4 rounded-xl bg-[#0A0908] border border-white/5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
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
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-white/40 font-semibold px-1">Find Recipient</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search className="text-white/30 h-[18px] w-[18px]" />
                    </span>
                    <input
                      type="text"
                      placeholder="Type username or display name"
                      value={recipientQuery}
                      onChange={(e) => setRecipientQuery(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#0A0908] border border-white/5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {recipientResults.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {recipientResults.map((result) => {
                      const isSelected = selectedRecipient?.id === result.id;
                      return (
                        <div
                          key={result.id}
                          onClick={() => setSelectedRecipient(result)}
                          className={`p-4 cursor-pointer rounded-2xl border transition-all duration-200 ${
                            isSelected
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-white/5 bg-[#0A0908]'
                          }`}
                        >
                          <div className="flex justify-between gap-4 items-center">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-white text-sm truncate">
                                {result.title}
                              </h4>
                              <span className="text-xs text-[#9B9691] mt-0.5 block truncate">
                                {result.subtitle}
                              </span>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-black border uppercase tracking-wider ${
                              result.publicKey 
                                ? 'border-emerald-500/30 text-emerald-500' 
                                : 'border-white/10 text-[#9B9691]'
                            }`}>
                              {result.publicKey ? "Secure" : "No key"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleShare}
                  disabled={sharing || !selectedSource || !selectedRecipient?.publicKey}
                  className="self-start px-8 py-3.5 bg-[#10B981] hover:bg-[#059669] text-black font-black rounded-2xl transition-all shadow-[0_8px_16px_rgba(16,185,129,0.1)] disabled:opacity-50 flex items-center gap-2"
                >
                  <Key size={16} />
                  {sharing ? "Sharing..." : "Share Securely"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDetail && selectedCredential && (
        <CredentialDetail
          credential={selectedCredential}
          onClose={() => setShowDetail(false)}
          isMobile={false}
        />
      )}
      </MultiSectionContainer>
    </div>
  );
}
