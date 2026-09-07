'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCredential,
  updateCredential,
} from '@/lib/appwrite';
import type { Credentials, CredentialsCreate } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import { generateRandomPassword } from '@/utils/password';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Globe,
  Lock,
  Plus,
  RotateCw,
  Save,
  Tag,
  Trash2,
  UploadCloud,
  User,
  X,
  CreditCard,
} from 'lucide-react';
import { useSection } from '@/context/SectionContext';
import { useSudo } from '@/context/SudoContext';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useWorkspace } from '@/context/WorkspaceContext';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import {
  ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS,
  measureEnvFieldsJson,
  parseEnvText,
  type EnvField,
} from '@/lib/vault/parse-env';

type CustomField = EnvField;

const inputClass =
  'w-full bg-black text-white placeholder-white border border-white/20 rounded-xl px-4 py-3 text-sm font-satoshi focus:outline-none focus:border-white/40 transition-colors';
const labelClass =
  'text-[0.72rem] font-bold text-white tracking-[0.08em] uppercase font-satoshi';

function normalizeCustomFields(raw: unknown): CustomField[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map((f: any, i: number) => ({
        id: String(f?.id || `cf-${i}`),
        label: String(f?.label ?? f?.key ?? ''),
        value: String(f?.value ?? ''),
      }));
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([label, value], i) => ({
        id: `cf-${i}`,
        label,
        value: String(value ?? ''),
      }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export default function CredentialDialog({
  open,
  onClose,
  initial,
  onSaved,
  prefill,
  defaultType = 'login',
}: {
  open: boolean;
  onClose: () => void;
  initial?: Credentials | null;
  onSaved: (saved?: Credentials) => void;
  prefill?: { name?: string; url?: string; username?: string };
  defaultType?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useAppwriteVault();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { setIsDrawerOpen } = useDrawerState();
  const { setActiveDetail } = useSection();
  const { requestSudo } = useSudo();
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [isEnvMode, setIsEnvMode] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    tags: '',
    cardNumber: '',
    cardholderName: '',
    cardExpiry: '',
    cardCVV: '',
    cardPIN: '',
    cardType: '',
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [envHint, setEnvHint] = useState<string | null>(null);

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
        if (typeof draft.isEnvMode === 'boolean') setIsEnvMode(draft.isEnvMode);
      } catch (e) {
        console.error('Failed to parse secret draft', e);
      }
    }
    setIsHydrated(true);
  }, [open, initial]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !isHydrated || initial) return;
    const draft = { form, customFields, isEnvMode };
    if (
      form.name.trim() ||
      form.username.trim() ||
      form.password.trim() ||
      form.cardNumber.trim() ||
      customFields.length > 0
    ) {
      localStorage.setItem('kylrix:draft:secret', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kylrix:draft:secret');
    }
  }, [open, isHydrated, form, customFields, isEnvMode, initial]);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        username: initial.username || '',
        password: initial.password || '',
        url: initial.url || '',
        notes: initial.notes || '',
        tags: initial.tags ? initial.tags.join(', ') : '',
        cardNumber: initial.cardNumber || '',
        cardholderName: initial.cardholderName || '',
        cardExpiry: initial.cardExpiry || '',
        cardCVV: initial.cardCVV || '',
        cardPIN: initial.cardPIN || '',
        cardType: initial.cardType || '',
      });
      setCustomFields(normalizeCustomFields(initial.customFields));
      setIsEnvMode(Boolean(initial.isEnv));
      setAttachments(initial.attachments ? JSON.parse(initial.attachments) : []);
    } else {
      setForm({
        name: prefill?.name || '',
        username: prefill?.username || '',
        password: '',
        url: prefill?.url || '',
        notes: '',
        tags: '',
        cardNumber: '',
        cardholderName: '',
        cardExpiry: '',
        cardCVV: '',
        cardPIN: '',
        cardType: '',
      });
      setCustomFields([]);
      setIsEnvMode(false);
      setAttachments([]);
    }
    setEnvHint(null);
    setError(null);
  }, [initial, open, prefill]);

  const applyEnvText = useCallback((text: string) => {
    const parsed = parseEnvText(text);
    if (!parsed.length) {
      setEnvHint('No KEY=VALUE lines found.');
      return;
    }
    if (measureEnvFieldsJson(parsed) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
      setError('This file is too large for one secret. Split it into smaller bundles.');
      return;
    }
    setCustomFields(parsed);
    setIsEnvMode(true);
    setEnvHint(`${parsed.length} variable${parsed.length === 1 ? '' : 's'} ready`);
    setError(null);
  }, []);

  const handlePasteEnv = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyEnvText(text);
    } catch {
      setError('Could not read clipboard. Paste into a text file and upload instead.');
    }
  }, [applyEnvText]);

  const handleEnvFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        applyEnvText(text);
        if (!form.name.trim()) {
          const base = file.name.replace(/\.(env|txt|dotenv)$/i, '').trim();
          if (base) setForm((f) => ({ ...f, name: base }));
        }
      } catch {
        setError('Could not read that file.');
      }
    },
    [applyEnvText, form.name],
  );

  const handleGeneratePassword = () => {
    setForm({ ...form, password: generateRandomPassword(16) });
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), label: '', value: '' },
    ]);
  };

  const updateCustomField = (id: string, field: 'label' | 'value', value: string) => {
    setCustomFields(customFields.map((cf) => (cf.id === id ? { ...cf, [field]: value } : cf)));
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
      setError(err.message || 'Failed to upload attachment.');
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
      setError(err.message || 'Failed to delete attachment.');
    }
  };

  const buildCredentialData = (): CredentialsCreate => {
    if (!user) throw new Error('Not authenticated');
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
      isEnv: isEnvMode,
      createdAt:
        initial && initial.createdAt ? initial.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEnvMode) {
      const usable = customFields.filter((f) => f.label.trim());
      if (!usable.length) throw new Error('Add at least one environment variable.');
      if (measureEnvFieldsJson(usable) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
        throw new Error('Environment bundle is too large. Split into smaller secrets.');
      }
      credentialData.customFields = JSON.stringify(usable);
      credentialData.password = null;
      credentialData.username = null;
      credentialData.url = null;
    } else if (type === 'login') {
      credentialData.username = form.username.trim();
      credentialData.password = form.password.trim();
      if (form.url && form.url.trim()) credentialData.url = form.url.trim();
      if (customFields.length > 0) {
        credentialData.customFields = JSON.stringify(customFields);
      }
    } else if (type === 'card') {
      credentialData.cardNumber = form.cardNumber.trim();
      credentialData.cardholderName = form.cardholderName.trim();
      credentialData.cardExpiry = form.cardExpiry.trim();
      credentialData.cardCVV = form.cardCVV.trim();
      credentialData.cardPIN = form.cardPIN.trim();
      credentialData.cardType = form.cardType.trim();
    }

    if (form.notes && form.notes.trim()) credentialData.notes = form.notes.trim();
    if (form.tags && form.tags.trim()) {
      const tagsArr = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tagsArr.length > 0) credentialData.tags = tagsArr;
    }

    return credentialData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!masterPassCrypto.isVaultUnlocked()) {
      requestSudo({
        onSuccess: () => {
          const fake = { preventDefault() {} } as React.FormEvent;
          void handleSubmit(fake);
        },
      });
      return;
    }

    setLoading(true);
    try {
      const credentialData = buildCredentialData();
      const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
      if (isCustomWorkspace) {
        (credentialData as any).isWorkspace = true;
      }

      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const { ID } = await import('appwrite');
      if (initial && initial.$id) {
        const localUpdated = {
          ...initial,
          ...credentialData,
          $id: initial.$id,
          $updatedAt: new Date().toISOString(),
        } as any;
        await LocalEngine.cacheSet(`vault_credential_${initial.$id}`, localUpdated).catch(() => {});
        void updateCredential(initial.$id, credentialData).catch(() => {});
        onSaved(localUpdated as any);
      } else {
        const tempId = ID.unique();
        const localCreated = {
          ...credentialData,
          $id: tempId,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
        } as any;
        await LocalEngine.cacheSet(`vault_credential_${tempId}`, localCreated).catch(() => {});
        try {
          const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
          const db = await getRxDB().catch(() => null);
          if (db) {
            const cacheKey = `vault_credentials_${user?.$id}`;
            const existing = await db.cache.findOne(cacheKey).exec().catch(() => null);
            const prev = (existing?.data as any) || [];
            await db.cache
              .upsert({
                id: cacheKey,
                data: [localCreated, ...(Array.isArray(prev) ? prev : [])],
                timestamp: Date.now(),
              })
              .catch(() => {});
          }
        } catch {}
        void createCredential(credentialData)
          .then(async (created: any) => {
            if (isCustomWorkspace && (created?.$id || (created as any)?.id)) {
              void attachEntityToActiveWorkspace(
                'credential',
                created.$id || (created as any).id,
              );
            }
            try {
              await LocalEngine.cacheDelete(`vault_credential_${tempId}`).catch(() => {});
              await LocalEngine.cacheSet(`vault_credential_${created.$id}`, created).catch(
                () => {},
              );
            } catch {}
          })
          .catch(() => {});
        onSaved(localCreated as any);
        if (typeof window !== 'undefined') localStorage.removeItem('kylrix:draft:secret');
      }
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || 'Failed to save credential.');
      setLoading(false);
    }
  };

  const handleMorphToDetail = async () => {
    if (!form.name.trim()) return;
    if (!masterPassCrypto.isVaultUnlocked()) {
      requestSudo({ onSuccess: () => void handleMorphToDetail() });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credentialData = buildCredentialData();
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
      setError(err.message || 'Failed to save credential.');
      setLoading(false);
    }
  };

  const currentType = initial?.itemType || defaultType;
  const showLoginFields = currentType === 'login' && !isEnvMode;

  const credentialForm = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 overflow-hidden bg-[#161412]">
      <div className="px-5 py-4 flex items-center justify-between shrink-0 font-clash">
        <div className="flex items-center gap-3 text-base font-bold text-white">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
          <span>
            {initial ? 'Edit' : 'New'}{' '}
            {isEnvMode ? 'Env' : currentType.charAt(0).toUpperCase() + currentType.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {form.name.trim().length > 0 && (
            <button
              type="button"
              onClick={handleMorphToDetail}
              className="p-1.5 rounded-lg text-white hover:bg-black transition-colors"
              title="Open detail"
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-white hover:bg-black transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 pb-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 font-satoshi">
        <div className="flex flex-col gap-2 w-full">
          <label className={labelClass}>
            Name <span className="text-[#ef4444]">*</span>
          </label>
          <input
            type="text"
            placeholder={isEnvMode ? 'e.g. Production API' : 'e.g. GitHub, Gmail'}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className={inputClass}
          />
        </div>

        {currentType === 'login' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-black px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode2 className="w-4 h-4 text-white shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">Environment file</p>
                <p className="text-[0.72rem] font-medium text-white tracking-wide uppercase">
                  One secret · many keys
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnvMode}
              onClick={() => {
                setIsEnvMode((v) => !v);
                setEnvHint(null);
                setError(null);
              }}
              className={`relative h-7 w-12 rounded-full border border-white/25 transition-colors shrink-0 ${
                isEnvMode ? 'bg-[#10B981]' : 'bg-[#161412]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5.5 w-5.5 rounded-full bg-white transition-transform ${
                  isEnvMode ? 'translate-x-5' : 'translate-x-0'
                }`}
                style={{ height: 22, width: 22 }}
              />
            </button>
          </div>
        )}

        {isEnvMode && currentType === 'login' && (
          <div className="flex flex-col gap-3 rounded-xl border border-white/20 bg-black p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePasteEnv}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 bg-[#161412] text-white text-sm font-bold hover:border-white/40 transition-colors"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 bg-[#161412] text-white text-sm font-bold hover:border-white/40 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".env,.txt,text/plain"
                className="hidden"
                onChange={handleEnvFile}
              />
            </div>
            {envHint && (
              <p className="text-[0.72rem] font-medium text-white tracking-wide uppercase px-0.5">
                {envHint}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className={labelClass}>Variables</span>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/10 px-2 py-1 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="text-sm text-white py-2">
                Paste a .env or upload a file — keys show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[28dvh] overflow-y-auto pr-0.5">
                {customFields.map((field) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="KEY"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, 'label', e.target.value)}
                      className={`${inputClass} flex-[0.9] py-2.5 font-mono text-xs`}
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={field.value}
                      onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                      className={`${inputClass} flex-[1.1] py-2.5 font-mono text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="p-2 text-white hover:bg-[#161412] rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showLoginFields && (
          <>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Username / Email <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative w-full">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="text"
                  placeholder="you@example.com"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Secret <span className="text-[#ef4444]">*</span>
              </label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Secret"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    className={`${inputClass} pl-11 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center justify-center bg-black text-[#10B981] border border-white/20 rounded-xl w-12 h-12 shrink-0 hover:border-[#10B981]/50"
                  title="Generate"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>Website URL</label>
              <div className="relative w-full">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>
          </>
        )}

        {currentType === 'card' && (
          <>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Card Number <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative w-full">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="text"
                  placeholder="•••• •••• •••• ••••"
                  value={form.cardNumber}
                  onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                  required
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Cardholder Name <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                placeholder="JOHN DOE"
                value={form.cardholderName}
                onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <label className={labelClass}>
                  Expiry <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={form.cardExpiry}
                  onChange={(e) => setForm({ ...form, cardExpiry: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className={labelClass}>
                  CVV <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="•••"
                  value={form.cardCVV}
                  onChange={(e) => setForm({ ...form, cardCVV: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 w-full">
          <label className={labelClass}>Tags</label>
          <div className="relative w-full">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
            <input
              type="text"
              placeholder="work, api, private"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label className={labelClass}>
            {currentType === 'note' ? 'Note Content' : 'Notes'}
          </label>
          <div className="relative w-full">
            <FileText className="absolute left-4 top-3 w-[18px] h-[18px] text-white pointer-events-none" />
            <textarea
              rows={currentType === 'note' ? 8 : 2}
              placeholder={
                currentType === 'note' ? 'Write your secure note here...' : 'Optional notes...'
              }
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${inputClass} pl-11 resize-none`}
            />
          </div>
        </div>

        {!isEnvMode && (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Custom Fields</span>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-2.5 py-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {customFields.map((field) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Label"
                  value={field.label}
                  onChange={(e) => updateCustomField(field.id, 'label', e.target.value)}
                  className={`${inputClass} flex-1 py-2.5`}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                  className={`${inputClass} flex-1 py-2.5`}
                />
                <button
                  type="button"
                  onClick={() => removeCustomField(field.id)}
                  className="p-2 text-white hover:bg-black rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Attachments</span>
            {initial && initial.$id && (
              <label
                className={`flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  uploadingAttachment ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingAttachment ? (
                  <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{uploadingAttachment ? 'Uploading…' : 'Upload'}</span>
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
              <p className="text-sm text-white">No files yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {attachments.map((att: any, idx: number) => (
                  <div
                    key={att.id || idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-black border border-white/20"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-bold text-white truncate">{att.name}</p>
                      <p className="text-[0.72rem] text-white uppercase tracking-wide">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-2 text-white hover:bg-[#161412] rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-white">Save first to attach files.</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-black text-[#ef4444] p-3 rounded-xl border border-white/20 text-xs font-medium">
            {error}
          </div>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-2 shrink-0 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold bg-[#10B981] hover:bg-[#0fa976] text-black disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-clash"
        >
          {!loading && <Save className="w-4 h-4" />}
          <span>
            {loading ? 'Saving…' : initial ? 'Update' : isEnvMode ? 'Save Env' : 'Save Secret'}
          </span>
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl font-bold text-white hover:bg-black transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (!open) return null;

  if (!isMobile) {
    return (
      <NativeSidebarMount
        active={open}
        sidebarKey="create-secret"
        width={520}
        title={initial ? 'Edit Secret' : isEnvMode ? 'New Env' : 'New Secret'}
      >
        <div className="h-full bg-[#161412] flex flex-col overflow-hidden">{credentialForm}</div>
      </NativeSidebarMount>
    );
  }

  return (
    <div className="fixed inset-0 z-[1400] flex justify-end items-end overflow-hidden">
      <div className="absolute inset-0 bg-black/80 animate-in fade-in z-0" onClick={handleClose} />
      <div
        className={`relative z-[1401] bg-[#161412] border-t border-white/20 flex flex-col w-full max-w-[720px] mx-auto left-0 right-0 overflow-hidden ${
          isExpanded
            ? 'h-[100dvh] max-h-[100dvh] rounded-none'
            : 'h-[60dvh] max-h-[60dvh] rounded-t-[24px]'
        } animate-in slide-in-from-bottom duration-300`}
      >
        <div className="flex justify-center py-2.5 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#3D3A36]" />
        </div>
        {credentialForm}
      </div>
    </div>
  );
}
