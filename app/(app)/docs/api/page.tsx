import Link from 'next/link';
import { PAT_SCOPES, PAT_SCOPE_META } from '@/lib/api/scopes';
import { KYLRIX_API_SKILL_INSTALL, KYLRIX_API_BASE_PROD } from '@/lib/api/public';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/token',
    scope: '(any valid PAT)',
    summary: 'Inspect this PAT, its scopes, and the full scope catalog. Rescue hatch.',
    query: null as string | null,
  },
  {
    method: 'GET',
    path: '/token/scopes',
    scope: '(any valid PAT)',
    summary: 'List the scope catalog.',
    query: null,
  },
  {
    method: 'PATCH',
    path: '/token/scopes',
    scope: '(self)',
    summary: 'Replace scopes on this PAT. Body: { scopes: string[] }. No new token needed.',
    query: null,
  },
  {
    method: 'POST',
    path: '/token/scopes/grant',
    scope: '(self)',
    summary: 'Add scopes to this PAT. Body: { scopes: string[] }.',
    query: null,
  },
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
    method: 'POST',
    path: '/notes',
    scope: 'notes:write',
    summary: 'Create an idea. Body: { title, content?, isPublic?, tags? }.',
    query: null,
  },
  {
    method: 'GET',
    path: '/notes/:id',
    scope: 'notes:read',
    summary: 'Single idea. 404 if not owned.',
    query: null,
  },
  {
    method: 'PATCH',
    path: '/notes/:id',
    scope: 'notes:write',
    summary: 'Update an idea. Body: { title?, content?, isPublic? }.',
    query: null,
  },
  {
    method: 'DELETE',
    path: '/notes/:id',
    scope: 'notes:write',
    summary: 'Delete an idea you own.',
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
    method: 'POST',
    path: '/goals',
    scope: 'goals:write',
    summary: 'Create a goal. Body: { title, description?, status? }.',
    query: null,
  },
  {
    method: 'GET',
    path: '/goals/:id',
    scope: 'goals:read',
    summary: 'Single goal. 404 if not owned.',
    query: null,
  },
  {
    method: 'PATCH',
    path: '/goals/:id',
    scope: 'goals:write',
    summary: 'Update a goal. Body: { title?, description?, status? }.',
    query: null,
  },
  {
    method: 'DELETE',
    path: '/goals/:id',
    scope: 'goals:write',
    summary: 'Delete a goal you own.',
    query: null,
  },
  {
    method: 'GET',
    path: '/flows',
    scope: 'flows:read',
    summary: 'List flows owned by the token user.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'GET',
    path: '/workspaces',
    scope: 'workspaces:read',
    summary: 'List workspaces (projects) you own. Alias: /projects.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'GET',
    path: '/chats',
    scope: 'chats:read',
    summary: 'List chat conversations you participate in.',
    query: 'limit (1–100, default 25)',
  },
  {
    method: 'GET',
    path: '/agents/sessions',
    scope: 'agents:read',
    summary: 'List agent sessions. Query harness=… for mirror sessions.',
    query: 'limit, harness',
  },
  {
    method: 'POST',
    path: '/agents/harness',
    scope: 'agents:harness + agents:write',
    summary: 'Create a CLI mirror session. Body: { harness, title? }.',
    query: null,
  },
  {
    method: 'POST',
    path: '/agents/sessions/:id/mirror',
    scope: 'agents:harness + agents:write',
    summary: 'Append a read-only mirror turn. Body: { role?, content?, toolCalls? }.',
    query: null,
  },
  {
    method: 'GET',
    path: '/pats',
    scope: 'pats:read',
    summary: 'List your personal access tokens (secrets never returned).',
    query: null,
  },
] as const;

const ERRORS = [
  { status: 401, code: 'unauthorized', meaning: 'Missing Authorization Bearer header' },
  { status: 401, code: 'invalid_pat', meaning: 'Token invalid, expired, or revoked' },
  { status: 403, code: 'scope_denied', meaning: 'Required permission not on this token' },
  { status: 404, code: 'not_found', meaning: 'Unknown path or resource' },
  { status: 410, code: 'gone', meaning: 'Retired path (e.g. /tools/execute) — use REST CRUD' },
  { status: 413, code: '—', meaning: 'Request body larger than ~256 KB' },
  { status: 429, code: 'rate_limited', meaning: 'Slow down; honor Retry-After header' },
  { status: 500, code: 'internal_error', meaning: 'Unexpected server failure' },
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
            <code className="text-white/70">Authorization: Bearer kyl_pat_…</code> or an OAuth
            access token from Sign in with Kylrix. REST CRUD
            only — tools are internal and not exposed over HTTP.
          </p>
        </div>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skill
          </h2>
          <p className="text-sm text-white/50">
            Install into Claude Code, Cursor, and other agent tools.
          </p>
          <CodeBlock>{KYLRIX_API_SKILL_INSTALL}</CodeBlock>
          <p className="text-xs text-white/40">
            Create tokens in{' '}
            <Link href="/settings?tab=developers" className="text-[#A5B4FC] hover:text-white">
              Settings → Developers
            </Link>
            . For Sign in with Kylrix, see{' '}
            <Link href="/docs/oauth2" className="text-[#A5B4FC] hover:text-white">
              OAuth docs
            </Link>
            .
          </p>
        </section>

        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Quick start
          </h2>
          <CodeBlock>{`export KYLRIX_PAT='kyl_pat_<id>_<secret>'

# Create an idea
curl -sS -X POST \\
  -H "Authorization: Bearer $KYLRIX_PAT" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Hello","content":"From the API","isPublic":false}' \\
  ${KYLRIX_API_BASE_PROD}/notes`}</CodeBlock>
          <p className="text-xs text-white/40">
            Success: <code className="text-white/60">{`{ "ok": true, "data": … }`}</code>. Errors:{' '}
            <code className="text-white/60">{`{ "ok": false, "error": { "code", "message" } }`}</code>.
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
            <li>Shown once at create (auto-copied); only a hash is stored.</li>
            <li>Prefer read-only scopes when write is not needed.</li>
            <li>Revoke compromised tokens immediately in Developers settings.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
