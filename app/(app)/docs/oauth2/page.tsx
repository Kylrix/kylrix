import Link from 'next/link';
import {
  KYLRIX_OAUTH2_SKILL_INSTALL,
  KYLRIX_DOCS_API,
} from '@/lib/api/public';
import { OAUTH2_DISCOVERY_URL, OAUTH2_CUSTOM_SCOPES } from '@/lib/oauth2/config';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
      {children}
    </pre>
  );
}

export default function DocsOAuth2Page() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-6">
        <div>
          <Link
            href="/docs"
            className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white"
          >
            ← Docs
          </Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">
            Sign in with Kylrix
          </h1>
          <p className="mt-2 text-sm text-white/50">
            OAuth 2.1 / OpenID Connect provider. Third-party apps send users to Kylrix for
            sign-in and receive tokens for your APIs.
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skill
          </h2>
          <CodeBlock>{KYLRIX_OAUTH2_SKILL_INSTALL}</CodeBlock>
          <p className="text-xs text-white/40">
            For HTTP API tokens and CRUD, use the{' '}
            <Link href="/docs/api" className="text-[#A5B4FC] hover:text-white">
              API skill
            </Link>{' '}
            instead.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Discovery
          </h2>
          <CodeBlock>{OAUTH2_DISCOVERY_URL}</CodeBlock>
          <p className="text-xs text-white/40">
            Point OIDC libraries here. Authorize, token, userinfo, and JWKS are listed in the
            document.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Register an app
          </h2>
          <ol className="text-sm text-white/55 space-y-2 list-decimal pl-4">
            <li>
              Open{' '}
              <Link href="/settings?tab=developers" className="text-[#A5B4FC] hover:text-white">
                Settings → Developers
              </Link>
            </li>
            <li>Under Sign in with Kylrix, tap Set up</li>
            <li>Choose server (secret) or browser/mobile (PKCE)</li>
            <li>Add your redirect URL and copy credentials</li>
          </ol>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Flow
          </h2>
          <ol className="text-sm text-white/55 space-y-2 list-decimal pl-4">
            <li>Redirect the user to the authorize endpoint</li>
            <li>User signs in and approves on kylrix.space/oauth/consent</li>
            <li>Your redirect receives an authorization code</li>
            <li>Exchange the code for tokens on your server (or with PKCE)</li>
            <li>
              Call{' '}
              <a href={KYLRIX_DOCS_API} className="text-[#A5B4FC] hover:text-white">
                /api/v1
              </a>{' '}
              with{' '}
              <code className="text-white/70">Authorization: Bearer &lt;access_token&gt;</code>
            </li>
          </ol>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Custom scopes
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {OAUTH2_CUSTOM_SCOPES.map((s) => (
              <span
                key={s}
                className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold font-mono bg-[#0A0908] border border-white/[0.06] text-white/60"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-white/40">
            Plus built-in openid, profile, email, and phone.
          </p>
        </section>
      </div>
    </div>
  );
}
