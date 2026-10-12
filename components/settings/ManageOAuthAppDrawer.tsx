'use client';

import React, { useEffect, useState } from 'react';
import { X, Copy, Plus, Trash2, AppWindow } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/openbricks/primitives';
import {
  createAppSecret,
  deleteApp,
  deleteAppTokens,
  getApp,
  updateApp,
  type OauthApp,
} from '@/lib/oauth2/apps';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

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

export function ManageOAuthAppDrawer({
  open,
  appId,
  onClose,
  onChanged,
}: {
  open: boolean;
  appId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { open: openDrawer } = useUnifiedDrawer();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [app, setApp] = useState<OauthApp | null>(null);
  const [name, setName] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>([]);
  const [newUri, setNewUri] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appId) return;
    let cancelled = false;
    setLoading(true);
    setFreshSecret(null);
    setNewUri('');
    void (async () => {
      try {
        const row = await getApp(appId);
        if (cancelled) return;
        setApp(row);
        setName(row.name || '');
        setRedirectUris([...(row.redirectUris || [])]);
        setEnabled(row.enabled !== false);
      } catch (err: any) {
        toast.error(err?.message || 'Could not load app');
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appId, onClose]);

  if (!open || !appId) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const addUri = () => {
    const uri = newUri.trim();
    if (!uri) return;
    if (redirectUris.includes(uri)) {
      toast.error('Already listed');
      return;
    }
    setRedirectUris((prev) => [...prev, uri]);
    setNewUri('');
  };

  const save = async () => {
    if (!app) return;
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    if (redirectUris.length === 0) {
      toast.error('Add at least one redirect URL');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateApp(app.$id, {
        name: name.trim(),
        redirectUris,
        type: app.type,
        enabled,
        logoUri: app.logoUri || undefined,
        description: app.description || undefined,
        tagline: app.tagline || undefined,
      });
      setApp(updated);
      setRedirectUris([...(updated.redirectUris || redirectUris)]);
      toast.success('Saved');
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const rotateSecret = async () => {
    if (!app) return;
    setSaving(true);
    try {
      const row = await createAppSecret(app.$id);
      setFreshSecret(row.secret);
      try {
        await navigator.clipboard.writeText(row.secret);
        toast.success('New secret copied — shown once');
      } catch {
        toast.success('New secret issued — copy it now');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not create secret');
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOut = () => {
    if (!app) return;
    openDrawer('delete-confirm', {
      title: `Sign everyone out of “${app.name}”?`,
      description:
        'Revokes every access and refresh token issued to this app. Users must approve access again the next time they sign in.',
      confirmLabel: 'Sign everyone out',
      resourceName: app.name,
      onConfirm: async () => {
        await deleteAppTokens(app.$id);
        toast.success('All sessions for this app were revoked');
      },
    });
  };

  const confirmDelete = () => {
    if (!app) return;
    openDrawer('delete-confirm', {
      title: `Delete “${app.name}”?`,
      description:
        'Deletes this OAuth app and invalidates every token it has issued. This cannot be undone.',
      confirmLabel: 'Delete app',
      resourceName: app.name,
      onConfirm: async () => {
        await deleteApp(app.$id);
        toast.success('App deleted');
        onChanged?.();
        onClose();
      },
    });
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
              Manage app
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
          {loading || !app ? (
            <p className="text-sm text-white/45 py-8 text-center">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#0A0908] border border-white/[0.06] text-[#6366F1] shrink-0 overflow-hidden">
                  {app.logoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.logoUri} alt="" className="h-5 w-5 object-cover rounded" />
                  ) : (
                    <AppWindow size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/40 font-mono truncate">{app.$id}</p>
                  <p className="text-[11px] text-white/35">
                    {app.type === 'public' ? 'Browser / mobile (PKCE)' : 'Server (secret)'}
                  </p>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-[#6366F1]"
                />
              </label>

              <div className="rounded-2xl bg-[#0A0908] border border-white/[0.06] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                    Client ID
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(app.$id)}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#A5B4FC] cursor-pointer"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
                <code className="block text-[11px] font-mono text-white/80 break-all select-all">
                  {app.$id}
                </code>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                  Redirect URLs
                </p>
                {redirectUris.length === 0 ? (
                  <p className="text-[11px] text-amber-300/90 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                    None saved — authorize will fail until you add one and save.
                  </p>
                ) : (
                  redirectUris.map((uri) => (
                    <div
                      key={uri}
                      className="flex items-start gap-2 rounded-2xl bg-[#0A0908] border border-white/[0.06] px-3 py-2.5"
                    >
                      <code className="flex-1 min-w-0 text-[11px] font-mono text-white/75 break-all">
                        {uri}
                      </code>
                      <button
                        type="button"
                        onClick={() => setRedirectUris((prev) => prev.filter((u) => u !== uri))}
                        className="p-1.5 rounded-lg text-red-300/80 hover:text-red-200 cursor-pointer shrink-0"
                        aria-label="Remove redirect URL"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
                <div className="flex gap-2">
                  <input
                    value={newUri}
                    onChange={(e) => setNewUri(e.target.value)}
                    placeholder="http://localhost:5003/auth/callback"
                    className="flex-1 min-w-0 rounded-2xl bg-[#0A0908] border border-white/10 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#6366F1]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addUri();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addUri}
                    className="inline-flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-[#161412] border border-white/10 text-white text-[11px] font-extrabold cursor-pointer shrink-0"
                  >
                    <Plus size={14} strokeWidth={3} />
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3">
                <div>
                  <p className="text-sm font-bold text-white">Enabled</p>
                  <p className="text-[11px] text-white/40">Turn off to block new sign-ins</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative h-7 w-12 rounded-full border transition-colors cursor-pointer shrink-0 ${
                    enabled ? 'bg-[#6366F1] border-[#6366F1]' : 'bg-[#161412] border-white/15'
                  }`}
                  aria-pressed={enabled}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      enabled ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {app.type !== 'public' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void rotateSecret()}
                    className="w-full py-3 rounded-2xl border border-white/10 text-white/80 text-sm font-extrabold cursor-pointer disabled:opacity-40"
                  >
                    Create new client secret
                  </button>
                  {freshSecret ? (
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 space-y-2">
                      <p className="text-[11px] font-bold text-amber-300">Secret — shown once</p>
                      <code className="block text-[11px] font-mono text-white/85 break-all select-all">
                        {freshSecret}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copy(freshSecret)}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-200 cursor-pointer"
                      >
                        <Copy size={12} />
                        Copy secret
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="w-full py-3.5 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={confirmSignOut}
                  className="py-3 rounded-2xl border border-amber-500/25 text-amber-200/90 text-[11px] font-extrabold cursor-pointer"
                >
                  Sign everyone out
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="py-3 rounded-2xl border border-red-500/25 text-red-300 text-[11px] font-extrabold cursor-pointer"
                >
                  Delete app
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
