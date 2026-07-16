import React, { useState, useEffect, useCallback } from 'react';
import ProjectLinker from '@/components/projects/ProjectLinker';
import type { Credentials } from '@/lib/appwrite/types';
import { storage } from '@/lib/appwrite';
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
  Share2
} from 'lucide-react';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
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

      let keyFragment = '';
      if (credential.dek) {
        // If DEK exists, decrypt the DEK value using user masterpass structure
        const { decryptField } = await import('@/lib/masterpass-crypto');
        const dekBase64 = await decryptField(credential.dek);
        keyFragment = `/${encodeURIComponent(dekBase64)}`;
      }
      
      const baseUrl = buildPublicResourceUrl('credential', credential.$id);
      const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Public sharing link copied with credentials DEK payload.');
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
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[0.75rem] font-bold text-white/50 tracking-wider uppercase">
        {label}
      </span>
      {onCopy && (
        <button 
          onClick={onCopy} 
          className="h-6 text-[0.7rem] font-bold px-2 rounded-md hover:bg-white/5 flex items-center gap-1.5 transition-colors text-[#10B981]"
        >
          <Copy className="w-3 h-3" />
          <span>{copied === fieldId ? "Copied!" : "Copy"}</span>
        </button>
      )}
    </div>
  );

  const FieldValue = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div
      className={`p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] font-mono text-sm text-white/95 break-all ${className}`}
    >
      {children}
    </div>
  );

  const content = (
    <div className={`h-full flex flex-col ${inline ? 'bg-transparent' : 'bg-[#0A0A0A]'} w-full min-h-0`}>
      {/* Header */}
      <div className="p-6 flex items-center gap-4 border-b border-white/[0.08] shrink-0">
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          {isMobile ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
        <h3 className="text-lg font-black text-white flex-1 font-space-grotesk">
          Credential Details
        </h3>
        <button 
          onClick={handleShareLink}
          className={`p-2 rounded-lg transition-all mr-1 border ${
            isPublic 
              ? 'text-emerald-500 bg-[#10B981]/15 border-[#10B981]/30 hover:bg-[#10B981]/25' 
              : 'text-white/40 bg-white/5 border-white/[0.08] hover:bg-white/10 hover:text-white'
          }`}
          title={isPublic ? "Copy Sharing Link" : "Publish & Share Link"}
        >
          <Share2 className="w-[18px] h-[18px]" />
        </button>
        <button 
          onClick={() => setShowProjectLinker(true)} 
          className="p-2 rounded-lg text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 hover:bg-[#10B981]/15 transition-all"
        >
          <Folder className="w-[18px] h-[18px]" />
        </button>
      </div>

      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={credential.$id} 
        entityKind="password" 
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Main Info Card */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-[18px] bg-white/[0.03] flex items-center justify-center border border-white/[0.08] overflow-hidden shrink-0">
            {faviconUrl ? (
              <img src={faviconUrl} className="w-9 h-9 object-contain" alt="" />
            ) : (
              <span className="text-3xl font-black text-[#10B981] font-clash">
                {credential.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xl font-black text-white truncate font-clash">
              {credential.name}
            </h4>
            {credential.url && (
              <div className="flex flex-col gap-1.5 items-start mt-1">
                <a 
                  href={credential.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#10B981] hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="truncate">{new URL(credential.url).hostname}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                {urlSafety && (
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider border ${
                      urlSafety.safe 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {urlSafety.safe ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    <span>{urlSafety.riskLevel} Risk: {urlSafety.reason}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <FieldLabel label="Username / Email" onCopy={() => handleCopy(credential.username || '', "username")} fieldId="username" />
            <FieldValue>{credential.username || "N/A"}</FieldValue>
          </div>

          {/* Secret */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.75rem] font-bold text-white/50 tracking-wider uppercase">
                Secret Value
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (!showPassword) {
                      requestSudo({ onSuccess: () => setShowPassword(true) });
                    } else {
                      setShowPassword(false);
                    }
                  }}
                  className="h-6 text-[0.7rem] font-bold px-2 rounded-md hover:bg-white/5 flex items-center gap-1.5 transition-colors text-[#10B981]"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? "Hide" : "Show"}</span>
                </button>
                <button 
                  onClick={() => requestSudo({ onSuccess: () => handleCopy(credential.password || '', "password") })}
                  className="h-6 text-[0.7rem] font-bold px-2 rounded-md hover:bg-white/5 flex items-center gap-1.5 transition-colors text-[#10B981]"
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
              <FieldValue className="whitespace-pre-wrap font-sans">
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
                    className="text-xs font-semibold px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="flex flex-col gap-4">
              <FieldLabel label="Custom Fields" />
              <div className="flex flex-col gap-4">
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
                    <div key={att.id || index} className="p-4 rounded-xl border border-white/10 bg-white/5">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <p className="text-sm font-bold text-white break-all">
                          {att.name}
                        </p>
                        <a 
                          href={fileUrl} 
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-md text-[#10B981] hover:bg-white/5 transition-colors shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-xs text-white/40">
                        {(att.size / 1024).toFixed(1)} KB • {att.mime || 'application/octet-stream'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-px bg-white/[0.08]" />

          {/* Metadata */}
          <div>
            <span className="text-[0.75rem] font-bold text-white/50 tracking-wider uppercase mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Information</span>
            </span>
            <div className="flex flex-col gap-2 mt-2">
              {credential.createdAt && (
                <p className="text-xs text-white/40">
                  Created: <span className="text-white/80">{formatDate(credential.createdAt)}</span>
                </p>
              )}
              {credential.updatedAt && (
                <p className="text-xs text-white/40">
                  Updated: <span className="text-white/80">{formatDate(credential.updatedAt)}</span>
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Drawer sheet */}
      <div 
        className="relative z-10 w-full sm:w-[440px] h-full bg-[#0A0A0Ad9] backdrop-blur-[25px] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {content}
      </div>
    </div>
  );
}
