'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Copy, AppWindow, ImagePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/openbricks/primitives';
import { createApp, createAppSecret } from '@/lib/oauth2/apps';
import { uploadOAuthAppLogo } from '@/lib/oauth2/logo';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

type Step = 'name' | 'type' | 'redirect' | 'logo' | 'done';

function paperSx(isDesktop: boolean) {
  return {
    bgcolor: '#161412',
    backgroundImage: 'none',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.06)',
    boxSizing: 'border-box' as const,
    ...(isDesktop
      ? {
          height: '100dvh',
          width: 'min(100vw, 420px)',
          borderRadius: '26px 0 0 26px',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }
      : {
          height: '60dvh',
          maxHeight: '60dvh',
          width: '100%',
          borderRadius: '26px 26px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }),
  };
}

export function CreateOAuthAppDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState<'confidential' | 'public'>('confidential');
  const [redirectUri, setRedirectUri] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{
    appId: string;
    secret: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setName('');
    setClientType('confidential');
    setRedirectUri('');
    setLogoPreview(null);
    setLogoFile(null);
    setCreating(false);
    setResult(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  if (!open) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const onPickLogo = (file: File | null) => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    const uri = redirectUri.trim();
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!uri) {
      toast.error('Redirect URL required');
      return;
    }
    setCreating(true);
    try {
      let logoUri: string | undefined;
      if (logoFile) {
        try {
          const uploaded = await uploadOAuthAppLogo(logoFile);
          logoUri = uploaded.logoUri;
        } catch (logoErr: any) {
          toast.error(logoErr?.message || 'Logo upload failed');
          setCreating(false);
          return;
        }
      }
      const app = await createApp({
        name: name.trim(),
        redirectUris: [uri],
        type: clientType,
        logoUri,
      });
      let secret: string | null = null;
      if (clientType === 'confidential') {
        try {
          const secretRow = await createAppSecret(app.$id);
          secret = secretRow.secret;
          try {
            await navigator.clipboard.writeText(secret);
            toast.success('App created — secret copied');
          } catch {
            toast.success('App created — copy the secret now');
          }
        } catch (secretErr: any) {
          // App exists; surface secret failure clearly so user can rotate later.
          toast.error(secretErr?.message || 'App created, but secret could not be issued');
          setResult({ appId: app.$id, secret: null });
          setStep('done');
          onCreated?.();
          return;
        }
      } else {
        toast.success('Public app created');
      }
      setResult({ appId: app.$id, secret });
      setStep('done');
      onCreated?.();
    } catch (err: any) {
      const detail =
        err?.response && typeof err.response === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(err.response);
                return parsed?.message || err.message;
              } catch {
                return err.message;
              }
            })()
          : err?.message;
      console.error('[CreateOAuthApp]', err);
      toast.error(detail || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal
      ModalProps={{ keepMounted: false }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      PaperProps={{ sx: paperSx(isDesktop) }}
    >
      <div className="flex flex-col h-full font-satoshi overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">
              Sign in with Kylrix
            </p>
            <h2 className="text-lg font-black font-clash text-white tracking-tight truncate">
              {step === 'name' && 'App name'}
              {step === 'type' && 'Client type'}
              {step === 'redirect' && 'Redirect URL'}
              {step === 'logo' && 'Logo'}
              {step === 'done' && 'Credentials'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/50 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
          {step === 'name' && (
            <>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vantage"
                className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3.5 text-sm text-white outline-none focus:border-[#6366F1]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setStep('type');
                }}
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep('type')}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 'type' && (
            <>
              <button
                type="button"
                onClick={() => setClientType('confidential')}
                className={`w-full text-left rounded-2xl border px-4 py-3.5 cursor-pointer ${
                  clientType === 'confidential'
                    ? 'border-[#6366F1]/40 bg-[#0A0908]'
                    : 'border-white/[0.06] bg-[#0A0908]'
                }`}
              >
                <p className="text-sm font-bold text-white">Server app</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Keeps a secret on your backend
                </p>
              </button>
              <button
                type="button"
                onClick={() => setClientType('public')}
                className={`w-full text-left rounded-2xl border px-4 py-3.5 cursor-pointer ${
                  clientType === 'public'
                    ? 'border-[#6366F1]/40 bg-[#0A0908]'
                    : 'border-white/[0.06] bg-[#0A0908]'
                }`}
              >
                <p className="text-sm font-bold text-white">Browser or mobile</p>
                <p className="text-[11px] text-white/40 mt-0.5">No secret — uses PKCE</p>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep('name')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-extrabold cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('redirect')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 'redirect' && (
            <>
              <input
                autoFocus
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                placeholder="https://example.com/auth/callback"
                className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3.5 text-sm text-white outline-none focus:border-[#6366F1]"
              />
              <p className="text-[11px] text-white/35">
                Must match exactly. Use https (or localhost for local testing).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep('type')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-extrabold cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!redirectUri.trim()}
                  onClick={() => setStep('logo')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 'logo' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-white/15 bg-[#0A0908] px-4 py-6 flex flex-col items-center gap-2 cursor-pointer"
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#6366F1]">
                    <ImagePlus size={22} />
                  </div>
                )}
                <p className="text-sm font-bold text-white">
                  {logoPreview ? 'Change logo' : 'Add logo (optional)'}
                </p>
                <p className="text-[11px] text-white/35">Compressed under 1MB before upload</p>
              </button>
              {logoFile && (
                <button
                  type="button"
                  onClick={() => onPickLogo(null)}
                  className="text-[11px] font-extrabold text-white/40 cursor-pointer"
                >
                  Remove
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep('redirect')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-extrabold cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
                >
                  <AppWindow size={16} />
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <>
              <div className="rounded-2xl bg-[#0A0908] border border-white/[0.06] p-4 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                  Client ID
                </p>
                <code className="block text-[11px] font-mono text-white/80 break-all select-all">
                  {result.appId}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(result.appId)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#A5B4FC] cursor-pointer"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>

              {result.secret ? (
                <div className="rounded-2xl bg-[#0A0908] border border-amber-500/25 p-4 space-y-2">
                  <p className="text-[11px] font-bold text-amber-400">
                    Client secret — shown once
                  </p>
                  <code className="block text-[11px] font-mono text-white/80 break-all select-all">
                    {result.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(result.secret!)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300 cursor-pointer"
                  >
                    <Copy size={12} />
                    Copy secret
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-white/45">
                  Public client — use PKCE on authorize and token exchange.
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
