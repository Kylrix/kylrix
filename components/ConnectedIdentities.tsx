'use client';

import { useCallback, useEffect, useState } from 'react';
import { OAuthProvider } from 'appwrite';
import { AppWindow } from 'lucide-react';
import { account } from '@/lib/appwrite/client';
import { getApp, type OauthApp } from '@/lib/oauth2/apps';
import { clearStatelessSessions } from '@/lib/utils';

/** Project-level Auth OAuth providers enabled for Kylrix sign-in (not Sign in with Kylrix). */
export const PROJECT_SIGN_IN_PROVIDERS: {
  id: OAuthProvider;
  key: string;
  name: string;
}[] = [
  { id: OAuthProvider.Google, key: 'google', name: 'Google' },
  { id: OAuthProvider.Github, key: 'github', name: 'GitHub' },
];

const OAUTH2_PREFIX = 'oauth2:';

type Identity = {
  $id: string;
  $createdAt: string;
  provider: string;
  providerEmail?: string;
  providerUid?: string;
};

type ExternalRow = {
  identity: Identity;
  appId: string;
  app: OauthApp | null;
};

function ProviderMark({ name }: { name: string }) {
  if (name === 'Google') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  }
  if (name === 'GitHub') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <AppWindow size={18} />;
}

export default function ConnectedIdentities() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [externals, setExternals] = useState<ExternalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await account.listIdentities();
      const all = (list.identities || []) as Identity[];
      const signIn = all.filter((i) => !i.provider?.startsWith(OAUTH2_PREFIX));
      const grants = all.filter((i) => i.provider?.startsWith(OAUTH2_PREFIX));
      setIdentities(signIn);

      const rows = await Promise.all(
        grants.map(async (identity) => {
          const appId = identity.provider.slice(OAUTH2_PREFIX.length);
          let app: OauthApp | null = null;
          try {
            app = await getApp(appId);
          } catch {
            app = null;
          }
          return { identity, appId, app };
        })
      );
      setExternals(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load');
      setIdentities([]);
      setExternals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const identityFor = (key: string) =>
    identities.find((i) => i.provider?.toLowerCase() === key.toLowerCase());

  const linkProvider = async (provider: OAuthProvider) => {
    setBusyId(provider);
    setError(null);
    try {
      clearStatelessSessions();
      const success = `${window.location.origin}/settings?tab=identities`;
      const failure = `${window.location.origin}/settings?tab=identities&error=oauth_failed`;
      await account.createOAuth2Session(provider, success, failure);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Link failed');
      setBusyId(null);
    }
  };

  const unlinkProvider = async (identityId: string) => {
    setBusyId(identityId);
    setError(null);
    try {
      await account.deleteIdentity(identityId);
      setIdentities((prev) => prev.filter((i) => i.$id !== identityId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unlink failed');
    } finally {
      setBusyId(null);
    }
  };

  const revokeExternal = async (identityId: string) => {
    setBusyId(identityId);
    setError(null);
    try {
      await account.deleteIdentity(identityId);
      setExternals((prev) => prev.filter((r) => r.identity.$id !== identityId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-white/40 font-satoshi py-6">Loading…</p>;
  }

  return (
    <div className="space-y-5 font-satoshi">
      {error ? (
        <p className="text-sm text-red-300 rounded-2xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5">
          {error}
        </p>
      ) : null}

      {/* Project Auth OAuth providers (Google / GitHub) — not Sign in with Kylrix */}
      <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-4 space-y-3">
        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Sign-in methods
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">
            Ways to sign into Kylrix
          </p>
        </div>
        <div className="space-y-2">
          {PROJECT_SIGN_IN_PROVIDERS.map((p) => {
            const linked = identityFor(p.key);
            const busy = busyId === p.id || busyId === linked?.$id;
            return (
              <div
                key={p.key}
                className="flex items-center gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[#161412] border border-white/[0.06] flex items-center justify-center text-white shrink-0">
                  <ProviderMark name={p.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-white/40 truncate">
                    {linked
                      ? linked.providerEmail || linked.providerUid || 'Connected'
                      : 'Not connected'}
                  </p>
                </div>
                {linked ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void unlinkProvider(linked.$id)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold border border-red-500/25 text-red-300 cursor-pointer disabled:opacity-40"
                  >
                    {busy ? '…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void linkProvider(p.id)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-[#6366F1] text-white cursor-pointer disabled:opacity-40"
                  >
                    {busy ? '…' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Sign in with Kylrix — third-party OAuth2 server clients */}
      <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-4 space-y-3">
        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            External apps
          </h3>
          <p className="text-[11px] text-white/35 mt-0.5">
            Apps using Sign in with Kylrix
          </p>
        </div>

        {externals.length === 0 ? (
          <p className="text-[12px] text-white/40 px-1 py-2">None yet</p>
        ) : (
          <div className="space-y-2">
            {externals.map((row) => {
              const busy = busyId === row.identity.$id;
              return (
                <div
                  key={row.identity.$id}
                  className="flex items-center gap-3 rounded-2xl bg-[#0A0908] border border-white/[0.05] px-3.5 py-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#161412] border border-white/[0.06] flex items-center justify-center text-[#A5B4FC] shrink-0 overflow-hidden">
                    {row.app?.logoUri ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.app.logoUri} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <AppWindow size={16} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {row.app?.name || 'Unknown app'}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono truncate">{row.appId}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeExternal(row.identity.$id)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold border border-red-500/25 text-red-300 cursor-pointer disabled:opacity-40"
                  >
                    {busy ? '…' : 'Revoke'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
