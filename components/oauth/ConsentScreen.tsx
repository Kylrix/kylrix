'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, ShieldX, Loader2, UserCheck, Users } from 'lucide-react';
import { account } from '@/lib/appwrite/client';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getApp } from '@/lib/oauth2/apps';
import {
  approveGrant,
  authorize,
  getGrant,
  rejectGrant,
  type Oauth2Grant,
} from '@/lib/oauth2/oauth2';
import { isLockedOidcScope, scopeLabel } from '@/lib/oauth2/config';
import { OAuth2HttpError } from '@/lib/oauth2/http';
import { useAuth } from '@/context/auth/AuthContext';

export function ConsentScreen() {
  const searchParams = useSearchParams();
  const { open: openDrawer } = useUnifiedDrawer();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [grant, setGrant] = useState<Oauth2Grant | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [app, setApp] = useState<any>(null);
  const grantIdParam = searchParams.get('grant_id') || searchParams.get('grantId');
  const prompts = useMemo(() => {
    const raw = searchParams.get('prompt') || '';
    return raw.split(/\s+/).filter(Boolean);
  }, [searchParams]);

  const forceAccountSelect = prompts.includes('select_account');

  useEffect(() => {
    if (forceAccountSelect && isAuthenticated && !grantIdParam) {
      setNeedsSignIn(true);
    }
  }, [forceAccountSelect, isAuthenticated, grantIdParam]);

  const authorizeParams = useMemo(
    () => ({
      clientId: searchParams.get('client_id') || undefined,
      redirectUri: searchParams.get('redirect_uri') || undefined,
      responseType: searchParams.get('response_type') || undefined,
      scope: searchParams.get('scope') || undefined,
      state: searchParams.get('state') || undefined,
      nonce: searchParams.get('nonce') || undefined,
      codeChallenge: searchParams.get('code_challenge') || undefined,
      codeChallengeMethod: searchParams.get('code_challenge_method') || undefined,
      prompt: searchParams.get('prompt') || undefined,
      maxAge: searchParams.get('max_age') || undefined,
      authorizationDetails: searchParams.get('authorization_details') || undefined,
      resource: searchParams.get('resource') || undefined,
      audience: searchParams.get('audience') || undefined,
      requestUri: searchParams.get('request_uri') || undefined,
    }),
    [searchParams]
  );

  const hydrateGrant = useCallback(async (grantId: string) => {
    const g = await getGrant(grantId);
    setGrant(g);
    setSelected([...g.scopes]);
    try {
      setApp(await getApp(g.appId));
    } catch {
      setApp(null);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsSignIn(false);
    try {
      if (grantIdParam) {
        await account.get();
        await hydrateGrant(grantIdParam);
        return;
      }

      // No grant_id: signed-out users keep authorize params; signed-in create the grant.
      try {
        await account.get();
      } catch {
        setNeedsSignIn(true);
        return;
      }

      const hasAuthorizeHints =
        !!authorizeParams.clientId ||
        !!authorizeParams.requestUri ||
        !!authorizeParams.redirectUri;

      if (!hasAuthorizeHints) {
        setError('This permission request is incomplete. Open it again from the app.');
        return;
      }

      const result = await authorize(authorizeParams);
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (!result.grantId) {
        setError('Could not start the permission request.');
        return;
      }
      // Keep grant_id in the URL for refresh / share
      const url = new URL(window.location.href);
      url.searchParams.set('grant_id', result.grantId);
      window.history.replaceState({}, '', url.toString());
      await hydrateGrant(result.grantId);
    } catch (err: any) {
      if (err instanceof OAuth2HttpError && err.status === 401) {
        setNeedsSignIn(true);
        return;
      }
      const msg = String(err?.message || '');
      if (/guest|unauthorized|401|missing scopes|not authorized/i.test(msg)) {
        setNeedsSignIn(true);
        return;
      }
      setError(msg || 'Could not load this request');
    } finally {
      setLoading(false);
    }
  }, [authorizeParams, grantIdParam, hydrateGrant]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // After login drawer succeeds, continue the grant flow automatically.
  useEffect(() => {
    if (!authLoading && isAuthenticated && needsSignIn) {
      void bootstrap();
    }
  }, [authLoading, isAuthenticated, needsSignIn, bootstrap]);

  const toggleScope = (scope: string) => {
    if (isLockedOidcScope(scope)) return;
    setSelected((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const onApprove = async () => {
    if (!grant) return;
    setActing(true);
    setError(null);
    try {
      // Always retain locked OIDC scopes from the grant
      const locked = grant.scopes.filter(isLockedOidcScope);
      const optional = selected.filter((s) => !isLockedOidcScope(s));
      const finalScopes = Array.from(new Set([...locked, ...optional]));
      const res = await approveGrant({
        grantId: grant.$id,
        scope: finalScopes.join(' '),
      });
      window.location.assign(res.redirectUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not allow access');
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!grant) return;
    setActing(true);
    setError(null);
    try {
      const res = await rejectGrant(grant.$id);
      window.location.assign(res.redirectUrl);
    } catch (err: any) {
      setError(err?.message || 'Could not deny access');
      setActing(false);
    }
  };

  const appName = app?.name || 'An app';

  return (
    <div className="min-h-[100dvh] bg-[#0A0908] text-white font-satoshi flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[28px] bg-[#161412] border border-white/[0.08] p-6 space-y-5 shadow-2xl">
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40">
            Sign in with Kylrix
          </p>
          <h1 className="text-2xl font-black font-clash tracking-tight text-white">
            Allow {appName}?
          </h1>
          {app?.tagline ? (
            <p className="text-sm text-white/45">{app.tagline}</p>
          ) : (
            <p className="text-sm text-white/45">
              This app wants permission to use your Kylrix account.
            </p>
          )}
        </div>

        {app?.logoUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.logoUri}
            alt=""
            className="h-14 w-14 rounded-2xl object-cover border border-white/10 bg-[#0A0908]"
          />
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center">
            <Loader2 className="animate-spin" size={18} />
            Loading request…
          </div>
        ) : needsSignIn ? (
          <div className="space-y-3">
            <p className="text-sm text-white/55">
              Sign in to Kylrix to continue. You will return here to review permissions.
            </p>
            <button
              type="button"
              onClick={() => openDrawer('login')}
              className="w-full py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void bootstrap()}
              className="w-full py-2.5 rounded-2xl border border-white/10 text-white/70 text-xs font-bold cursor-pointer"
            >
              I already signed in — continue
            </button>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : grant ? (
          <>
            {/* OIDC Account Selector Bar */}
            <div className="rounded-2xl bg-[#0A0908] border border-white/[0.06] p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-8 w-8 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 grid place-items-center shrink-0">
                  <UserCheck size={15} className="text-[#6366F1]" />
                </span>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 block">Signed in as</span>
                  <span className="text-xs font-extrabold text-white truncate block">{grant.userId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNeedsSignIn(true);
                  openDrawer('login');
                }}
                className="text-xs font-bold text-[#6366F1] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Users size={13} />
                Switch account
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/40">
                Permissions
              </p>
              <ul className="space-y-2">
                {grant.scopes.map((scope) => {
                  const locked = isLockedOidcScope(scope);
                  const on = selected.includes(scope);
                  return (
                    <li key={scope}>
                      <label
                        className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 cursor-pointer ${
                          on
                            ? 'border-[#6366F1]/40 bg-[#6366F1]/10'
                            : 'border-white/[0.06] bg-[#0A0908]'
                        } ${locked ? 'opacity-90' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 accent-[#6366F1]"
                          checked={on}
                          disabled={locked || acting}
                          onChange={() => toggleScope(scope)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-white">
                            {scopeLabel(scope)}
                          </span>
                          <span className="block text-[11px] text-white/35 font-mono">{scope}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={acting}
                onClick={() => void onReject()}
                className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 text-white/80 text-sm font-extrabold cursor-pointer disabled:opacity-40"
              >
                <ShieldX size={16} />
                Deny
              </button>
              <button
                type="button"
                disabled={acting || selected.length === 0}
                onClick={() => void onApprove()}
                className="inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
              >
                <ShieldCheck size={16} />
                Allow {appName}
              </button>
            </div>
          </>
        ) : null}

        {!loading && !needsSignIn && !grant && !error ? (
          <p className="text-sm text-white/45 text-center py-6">Nothing to review.</p>
        ) : null}
      </div>
    </div>
  );
}
