'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppWindow, Copy, Plus, Trash2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { account } from '@/lib/appwrite/client';
import {
  createApp,
  createAppSecret,
  deleteApp,
  deleteAppTokens,
  listMyApps,
  type OauthApp,
} from '@/lib/oauth2/apps';
import { OAUTH2_DISCOVERY_URL } from '@/lib/oauth2/config';

export function OAuthAppsPanel() {
  const [apps, setApps] = useState<OauthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [clientType, setClientType] = useState<'confidential' | 'public'>('confidential');
  const [revealedSecret, setRevealedSecret] = useState<{
    appId: string;
    secret: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const user = await account.get();
      const mine = await listMyApps(user.$id);
      setApps(mine);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    const uri = redirectUri.trim();
    if (!uri) {
      toast.error('Redirect URL required');
      return;
    }
    setCreating(true);
    try {
      const app = await createApp({
        name: name.trim(),
        redirectUris: [uri],
        type: clientType,
      });
      let secretShown: string | null = null;
      if (clientType === 'confidential') {
        const secretRow = await createAppSecret(app.$id);
        secretShown = secretRow.secret;
        setRevealedSecret({ appId: app.$id, secret: secretRow.secret });
        try {
          await navigator.clipboard.writeText(secretRow.secret);
          toast.success('App created — secret copied');
        } catch {
          toast.success('App created — copy the secret now');
        }
      } else {
        setRevealedSecret(null);
        toast.success('Public app created (uses PKCE)');
      }
      setName('');
      setRedirectUri('');
      if (!secretShown) {
        /* ok */
      }
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      await deleteApp(appId);
      toast.success('App deleted');
      if (revealedSecret?.appId === appId) setRevealedSecret(null);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleRevokeTokens = async (appId: string) => {
    try {
      await deleteAppTokens(appId);
      toast.success('All tokens for this app revoked');
    } catch (err: any) {
      toast.error(err?.message || 'Revoke failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-2.5">
        <p className="text-[11px] text-white/45">
          Third-party apps register here. Users approve access on your consent screen. Discovery
          URL for integrators:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-[10px] font-mono text-white/70 bg-[#161412] border border-white/[0.06] rounded-xl px-3 py-2 break-all select-all">
            {OAUTH2_DISCOVERY_URL}
          </code>
          <button
            type="button"
            onClick={() => void copy(OAUTH2_DISCOVERY_URL)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white cursor-pointer shrink-0"
          >
            <Copy size={14} />
            Copy
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="App name"
          className="w-full rounded-xl bg-[#161412] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-[#6366F1]"
        />
        <input
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          placeholder="https://example.com/auth/callback"
          className="w-full rounded-xl bg-[#161412] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-[#6366F1]"
        />
        <div className="flex flex-wrap gap-1.5">
          {(['confidential', 'public'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setClientType(t)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                clientType === t
                  ? 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                  : 'bg-[#161412] border-white/[0.06] text-white/35'
              }`}
            >
              {t === 'confidential' ? 'Server app (secret)' : 'Browser / mobile (PKCE)'}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#6366F1] text-white cursor-pointer disabled:opacity-40"
        >
          <Plus size={14} strokeWidth={3} />
          Create OAuth app
        </button>
      </div>

      {revealedSecret && (
        <div className="rounded-2xl bg-[#0A0908] border border-amber-500/25 p-3.5 space-y-2">
          <p className="text-[11px] font-bold text-amber-400">
            Client secret shown once. Store it on your server.
          </p>
          <p className="text-[10px] text-white/40 font-mono">client_id: {revealedSecret.appId}</p>
          <code className="block text-[11px] font-mono text-white/80 break-all select-all">
            {revealedSecret.secret}
          </code>
          <button
            type="button"
            onClick={() => void copy(revealedSecret.secret)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-[#161412] border border-white/[0.08] text-white cursor-pointer"
          >
            <Copy size={14} />
            Copy secret
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-white/40 px-1">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl bg-[#0A0908] border border-white/[0.05] px-4 py-8 text-center">
          <div className="mx-auto w-fit p-3 rounded-2xl bg-[#161412] border border-white/[0.06] text-[#6366F1] mb-3">
            <AppWindow size={20} />
          </div>
          <p className="text-sm font-bold text-white/50">No OAuth apps yet</p>
        </div>
      ) : (
        apps.map((app) => (
          <div
            key={app.$id}
            className="flex items-center gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] p-3.5"
          >
            <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
              <AppWindow size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{app.name}</p>
              <p className="text-[11px] text-white/40 font-mono truncate">
                {app.$id} · {app.type || 'confidential'}
              </p>
              <p className="text-[10px] text-white/30 truncate">
                {(app.redirectUris || [])[0] || 'No redirect'}
              </p>
            </div>
            <button
              type="button"
              title="Copy client id"
              onClick={() => void copy(app.$id)}
              className="p-2 rounded-lg bg-[#161412] border border-white/[0.08] text-white/70 cursor-pointer shrink-0"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              title="Revoke all tokens"
              onClick={() => void handleRevokeTokens(app.$id)}
              className="p-2 rounded-lg bg-[#161412] border border-white/[0.08] text-amber-300/80 cursor-pointer shrink-0"
            >
              <KeyRound size={14} />
            </button>
            <button
              type="button"
              title="Delete app"
              onClick={() => void handleDelete(app.$id)}
              className="p-2 rounded-lg bg-[#161412] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
