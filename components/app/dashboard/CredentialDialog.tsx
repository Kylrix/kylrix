import { useState, useEffect } from 'react';
import { 
  createCredential, 
  updateCredential 
} from '@/lib/appwrite';
import type { Credentials, CredentialsCreate } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import { generateRandomPassword } from '@/utils/password';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { 
  ArrowUpRight, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  RotateCw, 
  Plus, 
  X, 
  Save, 
  UploadCloud, 
  Trash2, 
  Globe, 
  Tag, 
  FileText, 
  User, 
  Lock, 
  CreditCard 
} from 'lucide-react';
import { useSection } from '@/context/SectionContext';

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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useAppwriteVault();
  const { setIsDrawerOpen } = useDrawerState();
  const { setActiveDetail } = useSection();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClose = () => {
    onClose();
    setIsExpanded(false);
    setIsHydrated(false);
  };

  useEffect(() => {
    setIsDrawerOpen(open);
    return () => setIsDrawerOpen(false);
  }, [open, setIsDrawerOpen]);

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
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft when drawer opens
  useEffect(() => {
    if (!open || typeof window === 'undefined' || initial) {
      setIsHydrated(false);
      return;
    }
    const raw = localStorage.getItem('kylrix:draft:secret');
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.form) setForm(draft.form);
        if (draft.customFields) setCustomFields(draft.customFields);
      } catch (e) {
        console.error('Failed to parse secret draft', e);
      }
    }
    setIsHydrated(true);
  }, [open, initial]);

  // Save draft when form or customFields change
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !isHydrated || initial) return;
    const draft = {
      form,
      customFields
    };
    if (form.name.trim() || form.username.trim() || form.password.trim() || form.cardNumber.trim() || customFields.length > 0) {
      localStorage.setItem('kylrix:draft:secret', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:secret');
    }
  }, [open, isHydrated, form, customFields, initial]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

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
      setAttachments(
        initial.attachments ? JSON.parse(initial.attachments) : [],
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
      { id: Date.now().toString(), label: "", value: "" }]);
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

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initial?.$id) return;
    setUploadingAttachment(true);
    setError(null);
    try {
      const { addAttachmentToCredential } = await import('@/lib/appwrite/vault');
      const updated = await addAttachmentToCredential(initial.$id, file);
      setAttachments(updated.attachments ? JSON.parse(updated.attachments) : []);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err.message || "Failed to upload attachment.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!initial?.$id) return;
    setError(null);
    try {
      const { deleteCredentialAttachment } = await import('@/lib/appwrite/vault');
      const updated = await deleteCredentialAttachment(initial.$id, fileId);
      setAttachments(updated.attachments ? JSON.parse(updated.attachments) : []);
    } catch (err: any) {
      console.error("Delete failed:", err);
      setError(err.message || "Failed to delete attachment.");
    }
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

      if (!user?.$id) {
        // Save as ghost credential in localStorage
        const secret = localStorage.getItem('kylrix_ghost_secret_v2') || crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const deletionSecret = crypto.randomUUID();
        const { sha256HexUtf8 } = await import('@/lib/crypto/sha256-hex');
        const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);

        const credentialPayload = {
          username: credentialData.username || undefined,
          password: credentialData.password || undefined,
          totpSecret: credentialData.totpId || undefined,
        };

        const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        const { encrypted: encTitle, key: noteKey } = await encryptGhostData(credentialData.name);
        const { encrypted: encContent } = await encryptGhostData(JSON.stringify(credentialPayload), noteKey);

        const id = initial?.$id || `ghost-${crypto.randomUUID()}`;
        const newRef = {
          id,
          title: credentialData.name,
          content: JSON.stringify(credentialPayload),
          metadata: JSON.stringify({
            isGhost: true,
            ghostSecret: secret,
            expiresAt,
            isEncrypted: true,
            creatorDeletionProofHash,
            send_object: { kind: 'password' }
          }),
          createdAt: new Date().toISOString(),
          expiresAt,
          decryptionKey: noteKey,
          deletionSecret,
        };

        const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
        let history = historyRaw ? JSON.parse(historyRaw) : [];
        if (!Array.isArray(history)) history = [];

        const existingIndex = history.findIndex((n: any) => n.id === id);
        if (existingIndex !== -1) {
          history[existingIndex] = newRef;
        } else {
          history.unshift(newRef);
        }

        localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
        window.dispatchEvent(new Event('storage'));

        onSaved();
        handleClose();
        setLoading(false);
        return;
      }

      if (initial && initial.$id) {
        await updateCredential(initial.$id, credentialData);
      } else {
        await createCredential(credentialData);
      }
      if (!initial && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:secret');
      }
      onSaved();
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Failed to save credential.");
      setLoading(false);
    }
  };

  const handleMorphToDetail = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const type = currentType;
      const credentialData: CredentialsCreate = {
        userId: user?.$id || "",
        name: form.name.trim(),
        itemType: type,
        username: null,
        url: null,
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

      let saved: any;
      if (initial && initial.$id) {
        saved = await updateCredential(initial.$id, credentialData);
      } else {
        saved = await createCredential(credentialData);
      }
      if (!initial && typeof window !== 'undefined') {
        localStorage.removeItem('kylrix:draft:secret');
      }
      onSaved();
      if (saved && (saved.$id || saved.id)) {
        setActiveDetail({ type: 'secret', id: saved.$id || saved.id, data: saved });
      }
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Failed to save credential.");
      setLoading(false);
    }
  };

  const currentType = initial?.itemType || defaultType;

  // Global Unmount Policy: conditionally render overlay content
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={handleClose}
      />
      
      {/* Drawer sheet */}
      <div 
        className={`
          relative z-10 bg-[#0A0908] border-t md:border-t-0 md:border-l border-white/[0.05] flex flex-col transition-all duration-300 ease-in-out
          w-full md:w-[600px] md:max-w-full
          ${isMobile 
            ? (isExpanded ? 'h-[100dvh] rounded-none' : 'h-[60dvh] rounded-t-[24px]') 
            : 'h-full'
          }
          animate-in
          ${isMobile 
            ? 'slide-in-from-bottom duration-300' 
            : 'slide-in-from-right duration-300'
          }
        `}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.05] shrink-0 font-space-grotesk">
            <div className="flex items-center gap-3 text-lg font-bold text-white">
              <div className="w-3 h-3 rounded-[3px] bg-[#10B981] shadow-[0_0_15px_#10B981]" />
              <span>{initial ? "Edit" : "New"} {currentType.charAt(0).toUpperCase() + currentType.slice(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              {form.name.trim().length > 0 && (
                <button 
                  type="button"
                  onClick={handleMorphToDetail} 
                  className="p-1.5 rounded-lg text-[#F59E0B] hover:text-white hover:bg-white/5 transition-colors"
                  title="Go Full Detail"
                >
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              )}
              {isMobile && (
                <button 
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)} 
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>
              )}
              <button 
                type="button"
                onClick={handleClose} 
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-6 py-5 flex-1 overflow-y-auto flex flex-col gap-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Name field */}
            <div className="flex flex-col gap-2 w-full">
              <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                Name <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., GitHub, Gmail"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
              />
            </div>

            {currentType === 'login' && (
              <>
                {/* Username field */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                    Username/Email <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <User className="w-[18px] h-[18px]" />
                    </div>
                    <input
                      type="text"
                      placeholder="john@example.com"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                    />
                  </div>
                </div>

                {/* Password / Secret field */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                    Secret <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                        <Lock className="w-[18px] h-[18px]" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Secret"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-11 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="flex items-center justify-center bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/20 rounded-xl w-12 h-12 transition-all shrink-0"
                      title="Generate Password"
                    >
                      <RotateCw className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Website URL field */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                    Website URL
                  </label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <Globe className="w-[18px] h-[18px]" />
                    </div>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {currentType === 'card' && (
              <>
                {/* Card Number */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                    Card Number <span className="text-[#ef4444]">*</span>
                  </label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <CreditCard className="w-[18px] h-[18px]" />
                    </div>
                    <input
                      type="text"
                      placeholder="•••• •••• •••• ••••"
                      value={form.cardNumber}
                      onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                      required
                      className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                    />
                  </div>
                </div>

                {/* Cardholder Name */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                    Cardholder Name <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="JOHN DOE"
                    value={form.cardholderName}
                    onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
                    required
                    className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                  />
                </div>

                {/* Expiry & CVV */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                      Expiry <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={form.cardExpiry}
                      onChange={(e) => setForm({ ...form, cardExpiry: e.target.value })}
                      required
                      className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                      CVV <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="•••"
                      value={form.cardCVV}
                      onChange={(e) => setForm({ ...form, cardCVV: e.target.value })}
                      required
                      className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            <div className="flex flex-col gap-2 w-full">
              <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                Tags
              </label>
              <div className="relative w-full">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <Tag className="w-[18px] h-[18px]" />
                </div>
                <input
                  type="text"
                  placeholder="work, email, private"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 w-full">
              <label className="text-[0.75rem] font-bold text-white/40 tracking-wide uppercase">
                {currentType === 'note' ? "Note Content" : "Notes"}
              </label>
              <div className="relative w-full">
                <div className="absolute left-4 top-3 text-white/30">
                  <FileText className="w-[18px] h-[18px]" />
                </div>
                <textarea
                  rows={currentType === 'note' ? 10 : 3}
                  placeholder={currentType === 'note' ? "Write your secure note here..." : "Secure notes..."}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#10B981]/30 focus:bg-white/[0.01] transition-all resize-none"
                />
              </div>
            </div>

            {/* Custom Fields */}
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between mt-2">
                <span className="text-[0.75rem] font-bold text-white/40 tracking-wider uppercase">
                  Custom Fields
                </span>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Field</span>
                </button>
              </div>
              
              {customFields.map((field) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => updateCustomField(field.id, "label", e.target.value)}
                    className="flex-1 bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#10B981]/30 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => updateCustomField(field.id, "value", e.target.value)}
                    className="flex-1 bg-[#161412] text-white placeholder-white/20 border border-white/[0.03] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#10B981]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Secure Attachments */}
            <div className="flex flex-col gap-3 w-full mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] font-bold text-white/40 tracking-wider uppercase">
                  Secure Attachments
                </span>
                
                {initial && initial.$id && (
                  <label
                    className={`flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${uploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {uploadingAttachment ? (
                      <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    <span>{uploadingAttachment ? "Uploading..." : "Upload File"}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleUploadAttachment}
                      disabled={uploadingAttachment}
                    />
                  </label>
                )}
              </div>

              {initial && initial.$id ? (
                attachments.length === 0 ? (
                  <p className="text-sm text-white/30 italic">
                    No attachments uploaded to this credential.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {attachments.map((att: any, idx: number) => (
                      <div 
                        key={att.id || idx}
                        className="flex justify-between items-center p-3 rounded-xl bg-[#161412] border border-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-bold text-white truncate break-all">
                            {att.name}
                          </p>
                          <p className="text-xs text-white/40">
                            {(att.size / 1024).toFixed(1)} KB • {att.mime || 'application/octet-stream'}
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-sm text-white/30 italic">
                  Save this credential first to enable secure file attachments.
                </p>
              )}
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-500/5 text-red-500 p-3.5 rounded-lg border border-red-500/20 text-xs">
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-5 gap-3 flex flex-col border-t border-white/[0.05] shrink-0 bg-[#0A0908] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button 
              type="button"
              onClick={onClose} 
              className="w-full py-3 rounded-xl font-bold text-white/40 hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold bg-[#10B981] hover:bg-[#0fa976] text-black shadow-[0_8px_25px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_30px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 text-sm font-space-grotesk"
            >
              {!loading && <Save className="w-4.5 h-4.5" />}
              <span>{loading ? "Saving..." : initial ? "Update" : "Add Credential"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
