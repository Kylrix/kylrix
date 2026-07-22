'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProjectLinker from '@/components/projects/ProjectLinker';
import type { Credentials } from '@/lib/appwrite/types';
import { storage, deleteCredential } from '@/lib/appwrite';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
import { 
  ArrowLeft, 
  X, 
  Copy, 
  Eye, 
  EyeOff, 
  Globe, 
  Calendar, 
  ShieldCheck, 
  ShieldAlert, 
  ExternalLink, 
  Folder,
  Share2,
  Lock,
  Key,
  Tag as TagIcon,
  Trash2,
  Sparkles,
  Info
} from 'lucide-react';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { useOverlay } from '@/components/ui/OverlayContext';
import toast from 'react-hot-toast';

export default function CredentialDetail({
  credential,
  onClose,
  isMobile,
  inline = false,
}: {
  credential: Credentials;
  onClose: () => void;
  isMobile: boolean;
  inline?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(!!credential.isPublic);
  const { requestSudo } = useSudo();
  const { openUnified } = useOverlay();

  const handleShareLink = useCallback(async () => {
    try {
      if (!isPublic) {
        const res = await toggleResourcePublicGuest({
          resourceType: 'credential',
          resourceId: credential.$id,
          mode: 'publish'
        });
        if (!res?.success) {
          toast.error('Failed to make credential public for sharing.');
          return;
        }
        setIsPublic(true);
        if (credential) {
          credential.isPublic = true;
        }
      }

      let currentDek = credential.dek;
      if (!currentDek) {
        const { decryptField, encryptField } = await import('@/lib/masterpass-crypto');
        const { VaultService } = await import('@/lib/appwrite/vault');
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        
        const newDek = await ecosystemSecurity.generateRandomMEK();
        const rawKey = await crypto.subtle.exportKey("raw", newDek);
        const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
        const wrappedDek = await encryptField(dekBase64);
        
        const plaintextFields: Record<string, any> = { dek: wrappedDek };
        const fieldsToProcess = ['name', 'url', 'username', 'password', 'notes', 'customFields'];
        for (const field of fieldsToProcess) {
          const val = (credential as any)[field];
          if (val && typeof val === 'string' && val.length > 20 && /^[A-Za-z0-9+/=]+$/.test(val)) {
            try {
              plaintextFields[field] = await decryptField(val);
            } catch {
              plaintextFields[field] = val;
            }
          } else {
            plaintextFields[field] = val;
          }
        }
        
        await VaultService.updateCredential(credential.$id, plaintextFields as any);
        credential.dek = wrappedDek;
        for (const field of fieldsToProcess) {
          if (plaintextFields[field] !== undefined) (credential as any)[field] = plaintextFields[field];
        }
        currentDek = wrappedDek;
      }

      let keyFragment = '';
      if (currentDek) {
        const { decryptField } = await import('@/lib/masterpass-crypto');
        const dekBase64 = await decryptField(currentDek);
        const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        keyFragment = `/${urlSafeDek}`;
      }
      
      const baseUrl = buildPublicResourceUrl('credential', credential.$id);
      const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Public sharing link copied.');
    } catch (err: any) {
      toast.error('Failed to copy share link: ' + err.message);
    }
  }, [credential, isPublic]);

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

  let customFields: any[] = [];
  try {
    if (credential.customFields) {
      customFields = JSON.parse(credential.customFields);
    }
  } catch {
    customFields = [];
  }

  let attachments: any[] = [];
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

  const FieldLabel = ({ label, onCopy, fieldId }: { label: string; onCopy?: () => void; fieldId?: string }) => (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">
        {label}
      </span>
      {onCopy && (
        <button 
          type="button"
          onClick={onCopy} 
          className="h-6 text-[10px] font-bold px-2 rounded-lg hover:bg-[#10B981]/10 flex items-center gap-1.5 transition-colors text-[#10B981]"
        >
          <Copy className="w-3 h-3" />
          <span>{copied === fieldId ? "Copied!" : "Copy"}</span>
        </button>
      )}
    </div>
  );

  const FieldValue = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div
      className={`p-3.5 rounded-xl bg-[#141211] border border-[#2C2A28] font-mono text-sm text-[#F5F2ED] break-all ${className}`}
    >
      {children}
    </div>
  );

  const content = (
    <div className={`h-full flex flex-col ${inline ? 'bg-transparent' : 'bg-[#161412]'} w-full min-h-0 text-[#F5F2ED]`}>
      {/* Header Bar matching TaskDetails / NoteDetailSidebar */}
      <div className="px-5 py-4 flex flex-col gap-3 border-b border-[#2C2A28] shrink-0 bg-[#161412]/95 backdrop-blur-md">
        {/* Row 1: Back/Close & Action Buttons */}
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 rounded-xl text-[#9B9691] hover:text-white hover:bg-white/5 transition-colors"
              title="Back"
            >
              {isMobile ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-[10px] font-bold text-[#10B981] uppercase tracking-wider font-mono">
              <Lock className="w-3 h-3" />
              <span>Vault Secret</span>
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              onClick={handleShareLink}
              className={`p-2 rounded-xl transition-all border ${
                isPublic 
                  ? 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30 hover:bg-[#10B981]/25' 
                  : 'text-[#9B9691] bg-white/5 border-[#2C2A28] hover:bg-white/10 hover:text-white'
              }`}
              title={isPublic ? "Copy Sharing Link" : "Publish & Share Link"}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={() => setShowProjectLinker(true)} 
              className="p-2 rounded-xl text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 hover:bg-[#10B981]/20 transition-all"
              title="Link Project"
            >
              <Folder className="w-4 h-4" />
            </button>
            <button 
              type="button"
              onClick={() => {
                openUnified('delete-confirm', {
                  title: 'Delete Vault Secret?',
                  description: `Are you sure you want to permanently delete "${credential.name}"?`,
                  onConfirm: async () => {
                    await deleteCredential(credential.$id);
                    toast.success('Secret deleted.');
                    onClose();
                  }
                });
              }}
              className="p-2 text-[#9B9691] hover:text-red-400 rounded-xl hover:bg-white/5 transition-all"
              title="Delete Secret"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Full-bleed Title & Sync Status Indicator matching TaskDetails / NoteDetailSidebar */}
        <div className="w-full min-w-0 flex flex-col gap-1.5 pt-1">
          <h2 className="w-full min-w-0 text-lg md:text-xl font-black font-clash text-[#10B981] tracking-tight uppercase break-words [overflow-wrap:anywhere]">
            {credential.name}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <SyncStatusDot resourceId={credential.$id} />
            <SyncStatusLabel resourceId={credential.$id} />
          </div>
        </div>
      </div>

      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={credential.$id} 
        entityKind="password" 
      />

      {/* Main Body with Deep Ash Balances */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Favicon & URL Hero Surface */}
        {credential.url && (
          <div className="p-4 rounded-2xl bg-[#1C1A18] border border-[#2C2A28] flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#141211] flex items-center justify-center border border-[#34322F] shrink-0 overflow-hidden">
              {faviconUrl ? (
                <img src={faviconUrl} className="w-7 h-7 object-contain" alt="" />
              ) : (
                <span className="text-xl font-black text-[#10B981] font-clash">
                  {credential.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">Website Domain</span>
              <a 
                href={credential.url} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate">{new URL(credential.url).hostname}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {urlSafety && (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    urlSafety.safe 
                      ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' 
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {urlSafety.safe ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  <span>{urlSafety.riskLevel} Risk: {urlSafety.reason}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fields List */}
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel label="Username / Email" onCopy={() => handleCopy(credential.username || '', "username")} fieldId="username" />
            <FieldValue>{credential.username || "N/A"}</FieldValue>
          </div>

          {/* Secret Password Value */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase font-clash">
                Secret Password
              </span>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    if (!showPassword) {
                      requestSudo({ onSuccess: () => setShowPassword(true) });
                    } else {
                      setShowPassword(false);
                    }
                  }}
                  className="h-6 text-[10px] font-bold px-2 rounded-lg hover:bg-[#10B981]/10 flex items-center gap-1.5 transition-colors text-[#10B981]"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? "Hide" : "Show"}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => requestSudo({ onSuccess: () => handleCopy(credential.password || '', "password") })}
                  className="h-6 text-[10px] font-bold px-2 rounded-lg hover:bg-[#10B981]/10 flex items-center gap-1.5 transition-colors text-[#10B981]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied === "password" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>
            <FieldValue className={showPassword ? 'text-white' : 'text-white/40 tracking-[0.3em]'}>
              {credential.password ? (showPassword ? credential.password : "••••••••••••••••") : "N/A"}
            </FieldValue>
          </div>

          {/* Notes */}
          {credential.notes && (
            <div>
              <FieldLabel label="Notes" onCopy={() => handleCopy(credential.notes || "", "notes")} fieldId="notes" />
              <FieldValue className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#D6D1CA]">
                {credential.notes}
              </FieldValue>
            </div>
          )}

          {/* Tags */}
          {credential.tags && credential.tags.length > 0 && (
            <div>
              <FieldLabel label="Tags" />
              <div className="flex flex-wrap gap-2 mt-1">
                {credential.tags.map((tag: string, index: number) => (
                  <span 
                    key={index} 
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#1C1A18] border border-[#2C2A28] text-white/80 inline-flex items-center gap-1.5"
                  >
                    <TagIcon size={10} className="text-[#10B981]" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="flex flex-col gap-3">
              <FieldLabel label="Custom Fields" />
              <div className="flex flex-col gap-3">
                {customFields.map((field: { id?: string; label?: string; value?: string }, index: number) => (
                  <div key={field.id || index} className="flex flex-col">
                    <FieldLabel 
                      label={field.label || `Field ${index + 1}`} 
                      onCopy={() => handleCopy(field.value || "", `custom-${index}`)} 
                      fieldId={`custom-${index}`} 
                    />
                    <FieldValue>{field.value || "Empty"}</FieldValue>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secure Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-col gap-3">
              <FieldLabel label="Secure Attachments" />
              <div className="flex flex-col gap-3">
                {attachments.map((att: any, index: number) => {
                  let fileUrl = "";
                  try {
                    const res = storage.getFileView('vault_attachments', att.id);
                    fileUrl = String(res);
                  } catch (err) {
                    console.error("Failed to generate preview URL:", err);
                  }

                  return (
                    <div key={att.id || index} className="p-3.5 rounded-xl border border-[#2C2A28] bg-[#141211]">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <p className="text-xs font-bold text-white break-all">
                          {att.name}
                        </p>
                        <a 
                          href={fileUrl} 
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-md text-[#10B981] hover:bg-[#10B981]/10 transition-colors shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-[10px] text-[#9B9691]">
                        {(att.size / 1024).toFixed(1)} KB • {att.mime || 'application/octet-stream'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-px bg-[#2C2A28] my-1" />

          {/* Metadata & Audit Info */}
          <div>
            <span className="text-[10px] font-bold text-[#9B9691] tracking-wider uppercase mb-2.5 flex items-center gap-1.5 font-clash">
              <Info className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Information</span>
            </span>
            <div className="flex flex-col gap-1.5 text-xs text-[#9B9691]">
              {credential.$id && (
                <p className="flex justify-between">
                  <span>Resource ID:</span>
                  <span className="font-mono text-white/80">{credential.$id}</span>
                </p>
              )}
              {credential.createdAt && (
                <p className="flex justify-between">
                  <span>Created:</span>
                  <span className="text-white/80">{formatDate(credential.createdAt)}</span>
                </p>
              )}
              {credential.updatedAt && (
                <p className="flex justify-between">
                  <span>Updated:</span>
                  <span className="text-white/80">{formatDate(credential.updatedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Drawer sheet */}
      <div 
        className="relative z-10 w-full sm:w-[480px] h-full bg-[#161412] border-l border-[#2C2A28] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {content}
      </div>
    </div>
  );
}
