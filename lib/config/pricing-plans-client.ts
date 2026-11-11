/**
 * Client-safe pricing plan snapshot (inlined at build time via next.config.js).
 */

export type PublicPricingPlan = {
  index: number;
  name: string;
  description: string;
  priceUsd: number;
  ledgerKey: string;
  exclusiveFeatures: Array<{ id: string; label: string }>;
};

export function getPublicPricingPlans(): PublicPricingPlan[] {
  const raw = process.env.NEXT_PUBLIC_PRICING_PLANS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PublicPricingPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Client plans with Pro/Teams fallback when build JSON is empty. */
export function getPublicPricingPlansOrDefault(): PublicPricingPlan[] {
  const plans = getPublicPricingPlans();
  if (plans.length > 0) return plans;
  return [
    {
      index: 1,
      name: 'Free',
      description: 'Universal Cloud Sync & Zero-Knowledge Vault',
      priceUsd: 0,
      ledgerKey: 'FREE',
      exclusiveFeatures: [
        { id: 'sync', label: 'Universal Cloud Sync across Web, CLI, VS Code, Discord, Telegram' },
        { id: 'vault', label: 'Full Zero-Knowledge Vault' },
        { id: 'workspaces', label: '1 Workspace' },
        { id: 'agent_token', label: '1 Agent Token' },
        { id: 'tools', label: '1,000 daily AI tool calls' },
      ],
    },
    {
      index: 2,
      name: 'Pro',
      description: '10x API Speed, Unlimited Workspaces & Agent Keys',
      priceUsd: 10,
      ledgerKey: 'PRO',
      exclusiveFeatures: [
        { id: 'high_speed_api', label: '10x API Speed (600 RPM, 50k calls/day)' },
        { id: 'unlimited_workspaces', label: 'Unlimited Workspaces' },
        { id: 'unlimited_agent_keys', label: 'Unlimited Agent Keys' },
        { id: 'sudo_window', label: '2-Hour Sudo Window' },
        { id: 'flows', label: 'Background Webhook Flows' },
        { id: 'ai', label: 'Intelligent AI Sidekick & Agents' },
        { id: 'voice', label: 'Audio messages & voice notes' },
        { id: 'file_upload', label: 'Cloud file storage & attachments' },
        { id: 'sharing', label: 'Direct sharing & collaborators on objects' },
      ],
    },
    {
      index: 3,
      name: 'Teams',
      description: '3,000 RPM, Team Roles, Shared Vaults & Audit Logs',
      priceUsd: 50,
      ledgerKey: 'TEAMS',
      exclusiveFeatures: [
        { id: 'teams_rpm', label: '3,000 RPM (500k calls/day)' },
        { id: 'team_roles', label: 'Team Roles & Collaboration' },
        { id: 'shared_vaults', label: 'Shared Zero-Knowledge Vaults' },
        { id: 'audit_logs', label: 'Full Audit Logs' },
        { id: 'projects', label: 'Projects & team workspaces' },
        { id: 'group_hangouts', label: 'Group hangouts & channels' },
      ],
    },
  ];
}
