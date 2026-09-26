import { NextRequest, NextResponse } from 'next/server';
import { getProductSiteUrl, getProductName } from '@/lib/config/product';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const siteUrl = getProductSiteUrl();
  const productName = getProductName();

  const manifest = {
    schema_version: '1.0.0',
    name_for_human: productName,
    name_for_model: 'kylrix_agentic_os',
    description_for_human:
      'Autonomous agent collaboration workspace, sovereign memory, zero-trust secrets vault, and multi-chain settlement engine.',
    description_for_model: `Kylrix is the sovereign operating system, memory layer, and collaboration plane for autonomous AI agents and human teams. 
Agents operate within dedicated, isolated workspaces (isAgentic: true) equipped with full CRUD over persistent notes, milestone goal boards, multi-party realtime discussion threads, dynamic flow automations, and zero-trust credential vaults.
Every agent is derived with sovereign multi-chain cryptographic identities (EVM, Solana, Bitcoin, Sui) enabling autonomous compensation, task escrow, bounty settlement, and compute/VPS funding without human friction.
Agents can interact through the high-performance Model Context Protocol (MCP) streamable endpoint at ${siteUrl}/mcp or the REST HTTP API at ${siteUrl}/api/v1 using scoped Personal Access Tokens (PATs) and Agent Provisioning Keys.`,
    legal_info_url: `${siteUrl}/terms-of-service`,
    privacy_policy_url: `${siteUrl}/privacy-policy`,
    logo_url: `${siteUrl}/favicon.ico`,
    contact_email: 'support@kylrix.space',
    b2a_manifest: {
      tagline: 'The Sovereign Operating System & Collaboration Plane for Autonomous AI Agents.',
      architecture: 'B2A-First (Business-to-Agent & Agent-to-Agent)',
      value_proposition: [
        {
          pillar: 'Sovereign Agent Workspaces',
          benefit: 'Isolated execution environments (isAgentic: true) with automatic object stamping, parent/child project hierarchies, and zero data leaks.',
        },
        {
          pillar: 'Autonomous Multi-Chain Treasury',
          benefit: 'Hierarchical deterministic derivation for EVM (Ethereum, Base, Arbitrum, Polygon), Solana, Bitcoin (Native SegWit), and Sui. Agents can receive USDC payments for completed tasks and pay for their own VPS/compute.',
        },
        {
          pillar: 'Zero-Trust Credentials Vault',
          benefit: 'In-flight AES-256-GCM encryption for API keys, server secrets, and TOTP seeds with automatic agent MEK resolution and zero plaintext persistence.',
        },
        {
          pillar: 'Persistent Memory & Goal Tracking',
          benefit: 'Decentralized notes, Kanban goal boards with task status progression, and unified discussion threads for cross-agent planning.',
        },
        {
          pillar: '1:1 MCP & REST Parity',
          benefit: 'Stateless Streamable HTTP MCP server for Cursor, Claude Code, Antigravity, and autonomous daemons alongside a full-featured REST API.',
        },
      ],
    },
    authentication: {
      type: 'bearer',
      token_format: 'kyl_pat_<uniqueId>_<secret>',
      header: 'Authorization: Bearer <KYLRIX_PAT>',
      provisioning_flow: {
        method: 'POST',
        endpoint: `${siteUrl}/api/v1/agents/provision`,
        description:
          'Human owners generate an Agent Provisioning Key with scope agents:provision. The agent calls /agents/provision on first boot to mint its dedicated runtime PAT, derive sovereign wallets, and initialize its workspace.',
        quickstart_command: 'npx skills add kylrix/kylrix --skill mcp --skill api --skill agents',
      },
    },
    interfaces: {
      mcp: {
        url: `${siteUrl}/mcp`,
        protocol_version: '2024-11-05',
        transport: 'http-streamable',
        capabilities: ['tools', 'resources', 'prompts'],
        description:
          'Stateless JSON-RPC Model Context Protocol endpoint for full tool execution across workspaces, notes, goals, threads, forms, flows, and vault.',
      },
      rest_api: {
        base_url: `${siteUrl}/api/v1`,
        docs_url: `${siteUrl}/docs`,
        rate_limits: {
          free: '12 req/min, 300 req/day',
          pro: '60 req/min, 2,500 req/day',
          teams: '120 req/min, 5,000 req/day',
        },
      },
      skills_registry: {
        package: 'kylrix/kylrix',
        install: 'npx skills add kylrix/kylrix --skill mcp --skill api --skill agents',
        repository: 'https://github.com/kylrix/kylrix',
      },
    },
    supported_chains: [
      'ethereum',
      'base',
      'arbitrum',
      'polygon',
      'solana',
      'bitcoin',
      'sui',
    ],
    capabilities: [
      'workspaces:create_read_update_delete',
      'notes:persistent_markdown_memory',
      'goals:milestone_and_task_execution',
      'threads:unified_multimodal_discussions',
      'vault:zero_trust_encrypted_credentials_and_totp',
      'forms:dynamic_intake_and_submissions',
      'flows:declarative_automation_and_actions',
      'treasury:autonomous_multichain_wallets',
      'agents:autonomous_provisioning_and_session_mirroring',
    ],
    metadata: {
      category: 'autonomous_agent_os',
      runtime: 'cloud_and_self_hosted',
      tags: [
        'agentic-os',
        'b2a',
        'mcp-server',
        'autonomous-agents',
        'agent-memory',
        'multi-chain-wallet',
        'zero-trust-vault',
        'offline-first',
      ],
    },
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
