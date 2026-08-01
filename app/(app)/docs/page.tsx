import Link from 'next/link';
import { KYLRIX_API_SKILL_INSTALL } from '@/lib/api/public';

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
            Guides for extending Kylrix with personal access tokens, tools, and apps.
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2.5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Install agent skill
          </h2>
          <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
            {KYLRIX_API_SKILL_INSTALL}
          </pre>
          <p className="text-xs text-white/40">
            Works with Claude Code, Cursor, and other tools that support the skills CLI.
          </p>
        </section>

        <div className="grid gap-3">
          <Link
            href="/docs/api"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">HTTP API</h2>
            <p className="text-xs text-white/45 mt-1">
              PATs, scopes, rate limits, endpoints, tools.execute, and errors.
            </p>
          </Link>
          <Link
            href="/settings?tab=developers"
            className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 hover:border-white/10 transition-colors"
          >
            <h2 className="font-clash text-lg font-semibold">Developers settings</h2>
            <p className="text-xs text-white/45 mt-1">
              Create and revoke tokens; copy the skill install command.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
