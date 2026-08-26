import Link from 'next/link';
import {
  KYLRIX_API_SKILL_INSTALL,
  KYLRIX_OAUTH2_SKILL_INSTALL,
  KYLRIX_AGENTS_SKILL_INSTALL,
} from '@/lib/api/public';

export default function DocsHomePage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 mb-2">
            Docs
          </p>
          <h1 className="font-clash text-3xl font-semibold tracking-tight">Kylrix docs</h1>
          <p className="mt-2 text-sm text-white/50 max-w-xl">
            HTTP API tokens, Sign in with Kylrix, and Autonomous Agents for developers.
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skills
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-white/70 mb-1.5">HTTP API</p>
              <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
                {KYLRIX_API_SKILL_INSTALL}
              </pre>
            </div>
            <div>
              <p className="text-xs font-bold text-white/70 mb-1.5">Sign in with Kylrix</p>
              <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
                {KYLRIX_OAUTH2_SKILL_INSTALL}
              </pre>
            </div>
            <div>
              <p className="text-xs font-bold text-white/70 mb-1.5">Autonomous Agents</p>
              <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
                {KYLRIX_AGENTS_SKILL_INSTALL}
              </pre>
            </div>
          </div>
        </section>

        <div className="grid gap-3">
          <Link
            href="/docs/markdown"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">Markdown rendering</h2>
            <p className="text-xs text-white/45 mt-1">
              Custom layers over marked — quote copy, file preview, math, charts, voice.
            </p>
          </Link>
          <Link
            href="/docs/api"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">HTTP API</h2>
            <p className="text-xs text-white/45 mt-1">
              Personal access tokens, scopes, rate limits, and REST endpoints.
            </p>
          </Link>
          <Link
            href="/docs/oauth2"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">Sign in with Kylrix</h2>
            <p className="text-xs text-white/45 mt-1">
              OAuth 2.1 / OIDC discovery, clients, consent, and access tokens.
            </p>
          </Link>
          <Link
            href="/docs/agents"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">Autonomous Agents</h2>
            <p className="text-xs text-white/45 mt-1">
              Zero-trust provisioning keys, dual-unlock encryption, and Nostr identity.
            </p>
          </Link>
          <Link
            href="/settings?tab=developers"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">Developers settings</h2>
            <p className="text-xs text-white/45 mt-1">
              Create tokens and OAuth apps; copy skill install commands.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
