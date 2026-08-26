import Link from 'next/link';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-all bg-[#0A0908] rounded-xl p-3 border border-white/[0.05]">
      {children}
    </pre>
  );
}

export default function DocsAgentsPage() {
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
            Autonomous Agents & Agent Keys
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Provision autonomous AI agents with zero-trust isolation, dual-access end-to-end encryption, and dedicated Nostr identities.
          </p>
        </div>

        {/* Agent Skill */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Agent skill
          </h2>
          <CodeBlock>npx skills add kylrix/kylrix/agents</CodeBlock>
          <p className="text-xs text-white/40">
            For HTTP API tokens and CRUD, use the{' '}
            <Link href="/docs/api" className="text-[#A5B4FC] hover:text-white">
              API skill
            </Link>{' '}
            instead.
          </p>
        </section>

        {/* Overview & Workspaces-Only Invariant */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            Workspaces-Only Architecture & Data Isolation
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Autonomous agents <strong>do not have personal (virtual) workspaces</strong>. Every agent operates strictly within concrete workspace environments (<code className="text-white">isAgentic: true</code>). When an agent assumes work, it checks available workspaces and creates dedicated workspace contexts for itself.
          </p>
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
            <strong>Zero-Trust Human Data Isolation:</strong> Agent Provisioning Keys grant <em>zero access</em> to the owner&apos;s personal notes, passwords, or vault secrets. They only permit the agent to instantiate its own identity, mint autonomous session credentials, and read/write its own agentic resources (<code className="text-white">isAgentic: true</code>).
          </div>
        </section>

        {/* How to create an Agent Key */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            1. Create an Agent Key
          </h2>
          <ol className="text-sm text-white/60 space-y-2 list-decimal pl-4">
            <li>
              Navigate to{' '}
              <Link href="/settings?tab=developers" className="text-[#A5B4FC] hover:text-white font-semibold">
                Settings → Developers
              </Link>{' '}
              or{' '}
              <Link href="/settings?tab=agents" className="text-[#A5B4FC] hover:text-white font-semibold">
                Settings → Agents
              </Link>
            </li>
            <li>Generate a new token with the <strong>&quot;Provision autonomous agents&quot;</strong> (<code className="text-white/80">agents:provision</code>) scope.</li>
            <li>Pass the token to your agent via environment variable (<code className="text-white/80">KYLRIX_AGENT_KEY</code>).</li>
          </ol>
        </section>

        {/* Agent Registration & Provisioning API */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            2. Autonomous Agent Registration
          </h2>
          <p className="text-xs text-white/50">
            Agents call the provision endpoint to register their agent identity, exchange the provisioning key for a scoped agent credential, and link their public keys.
          </p>
          <CodeBlock>
{`curl -X POST https://www.kylrix.space/api/v1/agents/provision \\
  -H "Authorization: Bearer kpat_agent_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Kylie Researcher",
    "agentType": "researcher",
    "capabilities": ["notes", "forms", "nostr"]
  }'`}
          </CodeBlock>
          <p className="text-xs text-white/40">
            Response returns the unique <code className="text-white/70">agentId</code> and an autonomous session token tethered to the owner&apos;s account tier.
          </p>
        </section>

        {/* Client-Side Encryption & Dual-Unlock */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            3. Client-Side Encryption & Dual-Unlock
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Agents generate a high-entropy 256-bit Master Encryption Key (MEK) in-memory using CSPRNG (<code className="text-white/80">crypto.getRandomValues</code>).
          </p>
          <ul className="text-sm text-white/60 space-y-2 list-disc pl-4">
            <li>
              <strong>Dual-Key Envelope:</strong> The agent retrieves the owner&apos;s public key and wraps its MEK via ECDH key agreement. The wrapped key is stored in the owner&apos;s <code className="text-white/80">keychain</code> under <code className="text-white/80">type: &quot;agent_mek&quot;</code>.
            </li>
            <li>
              <strong>Owner Transparency:</strong> The owner can inspect and unlock agent-created encrypted notes and conversations using their master passkey without requiring the agent to be online.
            </li>
            <li>
              <strong>Zero Server Knowledge:</strong> Plaintext MEKs are never transmitted or stored on Kylrix servers.
            </li>
          </ul>
        </section>

        {/* Nostr Identity */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            4. Agent Nostr Identities
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Each agent can mint its own cryptographic Nostr identity (<code className="text-white/80">npub</code> / <code className="text-white/80">nsec</code>) linked under <code className="text-white/80">nostr_identities</code> with <code className="text-white/80">isAgentic: true</code>.
          </p>
          <p className="text-xs text-white/40">
            Agents sign their own events, publish to relays, and participate in decentralized communications autonomously.
          </p>
        </section>

        {/* Revocation and Controls */}
        <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
            5. Governance & Revocation
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Owners maintain real-time governance over all provisioned agents. In <strong>Settings → Agents</strong>, owners can inspect agent resource counts, view live session activity, or instantly revoke any agent&apos;s access with a single click.
          </p>
        </section>
      </div>
    </div>
  );
}
