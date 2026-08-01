import Link from 'next/link';
import { PAT_SCOPES, PAT_SCOPE_META } from '@/lib/api/scopes';
import { KYLRIX_API_SKILL_INSTALL, KYLRIX_API_BASE_PROD } from '@/lib/api/public';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/me',
    scope: 'profile:read',
    summary: 'Token owner id, auth kind, granted scopes, patId.',
    query: null as string | null,
  },
  {
    method: 'GET',
    path: '/notes',
    scope: 'notes:read',
    summary: 'List ideas owned by the token user.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'GET',
    path: '/notes/:id',
    scope: 'notes:read',
    summary: 'Single idea (title, content, updatedAt, isPublic). 404 if not owned.',
    query: null,
  },
  {
    method: 'GET',
    path: '/goals',
    scope: 'goals:read',
    summary: 'List goals for the token user.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'GET',
    path: '/flows',
    scope: 'flows:read',
    summary: 'List flows owned by the token user.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'POST',
    path: '/tools/execute',
    scope: 'tools:execute',
    summary: 'Run a registered tool. Body: { toolId, params }.',
    query: null,
  },
] as const;

const ERRORS = [
  { status: 401, code: 'unauthorized', meaning: 'Missing Authorization Bearer header' },
  { status: 401, code: 'invalid_pat', meaning: 'Token invalid, expired, or revoked' },
  { status: 403, code: 'scope_denied', meaning: 'Required permission not on this token' },
  { status: 404, code: 'not_found', meaning: 'Unknown path or resource' },
  { status: 413, code: '—', meaning: 'Request body larger than ~256 KB' },
  { status: 429, code: 'rate_limited', meaning: 'Slow down; honor Retry-After header' },
  { status: 500, code: 'internal_error', meaning: 'Unexpected server failure' },
] as const;

const TOOL_GROUPS = [
  {
    title: 'Profile & search',
    ids: ['user.profile.read', 'user.settings.update', 'search.ecosystem', 'ui.navigate'],
  },
  {
    title: 'Workspaces',
    ids: [
      'workspace.create',
      'workspace.read',
      'workspace.update',
      'workspace.delete',
      'workspace.search',
    ],
  },
  {
    title: 'Ideas',
    ids: [
      'objects.idea.create',
      'objects.idea.read',
      'objects.idea.update',
      'objects.idea.delete',
      'objects.idea.search',
    ],
  },
  {
    title: 'Goals',
    ids: [
      'objects.goal.create',
      'objects.goal.read',
      'objects.goal.update',
      'objects.goal.delete',
      'objects.goal.search',
    ],
  },
  {
    title: 'Forms & tags',
    ids: [
      'objects.form.read',
      'objects.form.submit',
      'objects.tag.create',
      'objects.tag.search',
    ],
  },
  {
    title: 'Vault (sensitive)',
    ids: [
      'objects.vault.secret.create',
      'objects.vault.secret.read',
      'objects.vault.secret.delete',
      'objects.vault.secret.search',
    ],
  },
  {
    title: 'Developer PATs',
    ids: ['developer.pat.create', 'developer.pat.list', 'developer.pat.revoke'],
  },
] as const;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-[11px] font-mono text-white/60 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
      {children}
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-satoshi">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <div>
          <Link
            href="/docs"
            className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 hover:text-white"
          >
            ← Docs
          </Link>
          <h1 className="font-clash text-3xl font-semibold tracking-tight mt-3">HTTP API</h1>
          <p className="mt-2 text-sm text-white/50">
            Base path <code className="text-white/70">/api/v1</code>. Auth via{' '}
            <code className="text-white/70">Authorization: Bearer kyl_pat_…</code>
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skill
          </h2>
          <p className="text-sm text-white/50">
            Install into Claude Code, Cursor, and other agent tools so they know every endpoint
            and permission.
          </p>
          <CodeBlock>{KYLRIX_API_SKILL_INSTALL}</CodeBlock>
          <p className="text-xs text-white/40">
            Create tokens in{' '}
            <Link href="/settings?tab=developers" className="text-[#A5B4FC] hover:text-white">
              Settings → Developers
            </Link>
            .
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Quick start
          </h2>
          <CodeBlock>{`export KYLRIX_PAT='kyl_pat_<prefix>_<secret>'

curl -sS \\
  -H "Authorization: Bearer $KYLRIX_PAT" \\
  ${KYLRIX_API_BASE_PROD}/me`}</CodeBlock>
          <p className="text-xs text-white/40">
            Success envelope: <code className="text-white/60">{`{ "ok": true, "data": … }`}</code>.
            Errors: <code className="text-white/60">{`{ "ok": false, "error": { "code", "message" } }`}</code>.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Endpoints
          </h2>
          <ul className="space-y-4">
            {ENDPOINTS.map((ep) => (
              <li key={`${ep.method}:${ep.path}`} className="space-y-1">
                <p className="text-sm">
                  <code className="text-[#A5B4FC]">
                    {ep.method} /api/v1{ep.path}
                  </code>
                  <span className="text-white/35 text-xs ml-2 font-mono">{ep.scope}</span>
                </p>
                <p className="text-xs text-white/50">{ep.summary}</p>
                {ep.query && (
                  <p className="text-[11px] text-white/35">Query: {ep.query}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Tools execute
          </h2>
          <p className="text-sm text-white/50">
            Prefer REST list/get for reads. Use tools for mutations and richer ops. Requires{' '}
            <code className="text-white/70">tools:execute</code> plus matching resource scopes.
          </p>
          <CodeBlock>{`curl -sS -X POST \\
  -H "Authorization: Bearer $KYLRIX_PAT" \\
  -H "Content-Type: application/json" \\
  -d '{"toolId":"objects.idea.search","params":{"query":"roadmap"}}' \\
  ${KYLRIX_API_BASE_PROD}/tools/execute`}</CodeBlock>
          <div className="space-y-3 pt-1">
            {TOOL_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 mb-1.5">
                  {g.title}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {g.ids.map((id) => (
                    <li
                      key={id}
                      className="text-[10px] font-mono px-2 py-1 rounded-lg bg-[#0A0908] border border-white/[0.05] text-white/55"
                    >
                      {id}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Permissions
          </h2>
          <p className="text-xs text-white/40 mb-2">
            Grant least privilege. Catalog is additive — shipped scope names never rename.
          </p>
          <ul className="space-y-1.5 text-xs text-white/55">
            {PAT_SCOPES.map((s) => (
              <li key={s} className="flex items-baseline gap-2">
                <code className="text-white/80 shrink-0">{s}</code>
                <span>
                  {PAT_SCOPE_META[s].label}
                  {PAT_SCOPE_META[s].danger ? (
                    <span className="text-red-400/80 ml-1">· sensitive</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Rate limits
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-[#0A0908] border border-white/[0.05] p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/35">
                Free
              </p>
              <p className="text-white/70 mt-1">20 / min · 200 / hour</p>
            </div>
            <div className="rounded-xl bg-[#0A0908] border border-white/[0.05] p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/35">
                Pro / Teams
              </p>
              <p className="text-white/70 mt-1">120 / min · 5000 / hour</p>
            </div>
          </div>
          <p className="text-xs text-white/40 pt-1">
            Limits apply per token and per account. Body max ≈ 256 KB.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Errors
          </h2>
          <ul className="space-y-2 text-xs text-white/55">
            {ERRORS.map((e) => (
              <li key={`${e.status}-${e.code}`} className="flex gap-3">
                <span className="font-mono text-white/80 w-8 shrink-0">{e.status}</span>
                <code className="text-[#A5B4FC] w-28 shrink-0">{e.code}</code>
                <span>{e.meaning}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Security
          </h2>
          <ul className="list-disc pl-4 space-y-1.5 text-sm text-white/50">
            <li>Tokens act as you for granted scopes — treat like passwords.</li>
            <li>Shown once at create; only a hash is stored.</li>
            <li>Prefer read-only scopes for agents; avoid vault + tools:execute unless needed.</li>
            <li>Revoke compromised tokens immediately in Developers settings.</li>
            <li>OAuth apps (Sign in with Kylrix) coming soon — use PATs until then.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
