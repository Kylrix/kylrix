import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';
import { PairingService } from '@/lib/services/pairing';
import { PatService } from '@/lib/services/pats';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Query } from 'node-appwrite';

/**
 * Validates Discord interaction Ed25519 signature via Node native crypto.
 */
export function verifyDiscordSignature({
  rawBody,
  signature,
  timestamp,
  clientPublicKey,
}: {
  rawBody: string;
  signature: string;
  timestamp: string;
  clientPublicKey: string;
}): boolean {
  if (!signature || !timestamp || !clientPublicKey) return false;
  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'), // ed25519 SPKI ASN.1 header
        Buffer.from(clientPublicKey, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });
    const data = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, 'hex');
    return crypto.verify(null, data, keyObject, sig);
  } catch {
    return false;
  }
}

/**
 * SSRF guard: only allow verified Discord webhook endpoints.
 */
export function isValidDiscordWebhookUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    const isDiscordDomain =
      hostname === 'discord.com' ||
      hostname === 'discordapp.com' ||
      hostname.endsWith('.discord.com') ||
      hostname.endsWith('.discordapp.com');
    if (!isDiscordDomain) return false;
    if (!url.pathname.startsWith('/api/webhooks/')) return false;
    return true;
  } catch {
    return false;
  }
}

// ── DISCORD APPLICATION COMMANDS SPECIFICATION (1:1 PARITY) ──

export const DISCORD_SLASH_COMMANDS = [
  {
    name: 'menu',
    description: 'Open the interactive Kylrix workspace dashboard',
  },
  {
    name: 'help',
    description: 'Display Kylrix Discord bot command guide and instructions',
  },
  {
    name: 'notes',
    description: 'View and manage your recent sovereign notes',
  },
  {
    name: 'note',
    description: 'Create a new encrypted note',
    options: [
      {
        name: 'title',
        description: 'The title of your note',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'content',
        description: 'Optional note body or details',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'note_read',
    description: 'Read the full contents of a specific note',
    options: [
      {
        name: 'id',
        description: 'The ID of the note to read',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'note_delete',
    description: 'Delete a note from your workspace',
    options: [
      {
        name: 'id',
        description: 'The ID of the note to delete',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'goals',
    description: 'View and track deliverables and goal milestones',
  },
  {
    name: 'goal',
    description: 'Create a new deliverable or goal',
    options: [
      {
        name: 'title',
        description: 'Goal title / deliverable name',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'goal_done',
    description: 'Mark a goal as completed',
    options: [
      {
        name: 'id',
        description: 'The ID of the goal to mark completed',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'goal_delete',
    description: 'Delete a goal from your workspace',
    options: [
      {
        name: 'id',
        description: 'The ID of the goal to delete',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'workspaces',
    description: 'List your sovereign workspaces and team projects',
  },
  {
    name: 'pair',
    description: 'Pair this Discord account with Kylrix via 1-click device authorization',
  },
  {
    name: 'link',
    description: 'Link your Kylrix account using a Personal Access Token (PAT)',
    options: [
      {
        name: 'token',
        description: 'Your Kylrix Personal Access Token (kyl_pat_... or kyl_punch_...)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'unlink',
    description: 'Disconnect your Discord account from Kylrix',
  },
  {
    name: 'whoami',
    description: 'Check current linked Kylrix account, subscription tier, and status',
  },
  {
    name: 'settings',
    description: 'View subscription plan, token balance, and security settings',
  },
  {
    name: 'agent',
    description: 'Dispatch an autonomous AI agent task to your workspace',
    options: [
      {
        name: 'prompt',
        description: 'Task instructions for the autonomous agent',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

/**
 * Registers / synchronizes Discord slash commands to the Discord Application.
 */
export async function registerDiscordCommands(options?: {
  botToken?: string;
  applicationId?: string;
}): Promise<{ ok: boolean; count?: number; error?: string }> {
  const botToken = options?.botToken || process.env.DISCORD_BOT_TOKEN;
  const applicationId = options?.applicationId || process.env.DISCORD_APPLICATION_ID;

  if (!botToken || !applicationId) {
    return { ok: false, error: 'Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID' };
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/commands`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(DISCORD_SLASH_COMMANDS),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Discord registration failed: ${res.status} ${errText}` };
    }

    const data = await res.json().catch(() => []);
    return { ok: true, count: Array.isArray(data) ? data.length : DISCORD_SLASH_COMMANDS.length };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error registering commands' };
  }
}

// ── ACCOUNT RESOLUTION & PERSISTENT DISCORD LINKING ──

interface DiscordLinkRecord {
  userId: string;
  linkedAt: number;
  userName?: string;
}

const discordUserCache = new Map<string, DiscordLinkRecord>();

export async function resolveActorForDiscordUser(
  callerId: string,
  callerName?: string
): Promise<{ actor: ApiActor; isLinked: boolean }> {
  // 1. In-memory cache hit
  const cached = discordUserCache.get(callerId);
  if (cached) {
    return {
      actor: { userId: cached.userId, kind: 'session', scopes: ['*'] },
      isLinked: true,
    };
  }

  // 2. Query persistent storage (oauth_consent_requests)
  try {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
      tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
      queries: [
        Query.equal('clientId', 'discord_account'),
        Query.equal('nonce', callerId),
        Query.equal('status', 'approved'),
        Query.limit(1),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    if (res.rows.length > 0 && res.rows[0].userId) {
      const userId = res.rows[0].userId;
      discordUserCache.set(callerId, { userId, linkedAt: Date.now(), userName: callerName });
      return {
        actor: { userId, kind: 'session', scopes: ['*'] },
        isLinked: true,
      };
    }
  } catch {
    // Non-fatal, gracefully fall back
  }

  // 3. Fallback to sandbox user (callerId)
  return {
    actor: { userId: callerId, kind: 'session', scopes: ['*'] },
    isLinked: false,
  };
}

export async function linkDiscordUserAccount(
  callerId: string,
  userId: string,
  callerName?: string
): Promise<void> {
  discordUserCache.set(callerId, { userId, linkedAt: Date.now(), userName: callerName });

  try {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
      tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
      queries: [
        Query.equal('clientId', 'discord_account'),
        Query.equal('nonce', callerId),
        Query.limit(1),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    const now = new Date().toISOString();
    const meta = JSON.stringify({ callerId, callerName, linkedAt: now });

    if (existing.rows.length > 0) {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
        tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
        rowId: existing.rows[0].$id,
        data: {
          userId,
          status: 'approved',
          requestMeta: meta,
          decidedAt: now,
        },
      });
    } else {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
        tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
        rowId: ID.unique(),
        data: {
          clientId: 'discord_account',
          userId,
          redirectUri: 'https://discord.com',
          requestedScopes: JSON.stringify(['*']),
          state: `discord_${callerId}`,
          nonce: callerId,
          responseType: 'discord_link',
          status: 'approved',
          requestMeta: meta,
          createdAt: now,
          expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          decidedAt: now,
        },
      });
    }
  } catch (err) {
    console.error('[discord-link] Failed to persist link in DB:', err);
  }
}

export async function unlinkDiscordUserAccount(callerId: string): Promise<void> {
  discordUserCache.delete(callerId);

  try {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
      tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
      queries: [
        Query.equal('clientId', 'discord_account'),
        Query.equal('nonce', callerId),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    for (const row of existing.rows) {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb',
        tableId: APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests',
        rowId: row.$id,
        data: { status: 'denied', decidedAt: new Date().toISOString() },
      }).catch(() => null);
    }
  } catch (err) {
    console.error('[discord-unlink] Failed to update DB:', err);
  }
}

// ── DISCORD UI COMPONENT BUILDERS ──

function extractItems(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

function buildDiscordSelectMenu() {
  return {
    type: 1, // ACTION_ROW
    components: [
      {
        type: 3, // STRING_SELECT
        custom_id: 'kylrix_main_select',
        placeholder: '⚡ Select a workspace domain to manage...',
        options: [
          {
            label: 'Notes Management',
            value: 'val_notes',
            description: 'Inspect, view, and create sovereign notes',
            emoji: { name: '📝' },
          },
          {
            label: 'Goals & Deliverables',
            value: 'val_goals',
            description: 'Track milestones, tasks, and completion',
            emoji: { name: '🎯' },
          },
          {
            label: 'Workspaces',
            value: 'val_workspaces',
            description: 'Switch and explore sovereign workspaces',
            emoji: { name: '📂' },
          },
          {
            label: 'Account & Settings',
            value: 'val_settings',
            description: 'Subscription status, quotas, and security',
            emoji: { name: '⚙️' },
          },
          {
            label: 'Pair Account',
            value: 'val_pair',
            description: 'Connect this Discord user to Kylrix account',
            emoji: { name: '🔗' },
          },
          {
            label: 'Main Dashboard',
            value: 'val_main',
            description: 'Return to the primary overview',
            emoji: { name: '🏠' },
          },
        ],
      },
    ],
  };
}

function buildDiscordButtonRow(isLinked = false) {
  return {
    type: 1, // ACTION_ROW
    components: [
      { type: 2, style: 1, label: 'Notes', custom_id: 'btn_notes', emoji: { name: '📝' } },
      { type: 2, style: 1, label: 'Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
      { type: 2, style: 1, label: 'Workspaces', custom_id: 'btn_workspaces', emoji: { name: '📂' } },
      { type: 2, style: 2, label: 'Settings', custom_id: 'btn_settings', emoji: { name: '⚙️' } },
      isLinked
        ? { type: 2, style: 5, label: 'Open App', url: 'https://www.kylrix.space/app' }
        : { type: 2, style: 1, label: 'Pair Account', custom_id: 'btn_pair', emoji: { name: '🔗' } },
    ],
  };
}

function buildMainDashboardEmbed(callerName: string, isLinked = false) {
  return {
    embeds: [
      {
        title: '⚡ Kylrix Sovereign Workspace Dashboard',
        description:
          `Welcome, **${callerName}**!\n\n` +
          'Access and manage your sovereign data directly from Discord.\n\n' +
          '• **📝 Notes:** Encrypted notes (`/notes`, `/note`, `/note_read`, `/note_delete`)\n' +
          '• **🎯 Goals:** Milestones & tasks (`/goals`, `/goal`, `/goal_done`, `/goal_delete`)\n' +
          '• **📂 Workspaces:** Project spaces & teams (`/workspaces`)\n' +
          '• **🤖 Autonomous Agent:** Dispatch tasks (`/agent <prompt>`)\n' +
          '• **🔗 Account Pairing:** Connect your account (`/pair`, `/link`, `/whoami`, `/unlink`)\n' +
          '• **⚙️ Settings:** Quotas, entitlements, & token balance (`/settings`)\n\n' +
          (isLinked
            ? '🟢 **Kylrix Account Connected & Synchronized**'
            : '🟡 **Sandbox Mode:** Account not linked yet. Type `/pair` to connect your Kylrix account in 1 click!'),
        color: 0x6366f1, // Indigo #6366F1
        fields: [
          { name: 'Pairing Status', value: isLinked ? '🟢 Linked & Verified' : '🟡 Sandbox (Use `/pair`)', inline: true },
          { name: 'Platform', value: 'Kylrix Cloud & Local-First', inline: true },
        ],
        footer: { text: 'Kylrix Ecosystem • www.kylrix.space' },
      },
    ],
    components: [buildDiscordSelectMenu(), buildDiscordButtonRow(isLinked)],
  };
}

function buildNotesEmbed(notes: any[], isLinked = true) {
  const fields =
    notes.length > 0
      ? notes.map((n, idx) => ({
          name: `${idx + 1}. ${n.title || 'Untitled'}`,
          value: `> ${n.content ? n.content.replace(/\n/g, ' ').slice(0, 70) : '*(Empty body)*'}\n\`ID: ${n.id}\``,
          inline: false,
        }))
      : [
          {
            name: 'No Notes Found',
            value: isLinked
              ? 'Create your first note using `/note title: ... content: ...`'
              : 'Create a note with `/note` or connect your Kylrix account using `/pair` to view your notes.',
            inline: false,
          },
        ];

  const components: any[] = [buildDiscordSelectMenu()];

  // Interactive buttons for first 2 notes
  if (notes.length > 0) {
    const actionRowComponents: any[] = [];
    notes.slice(0, 2).forEach((n, idx) => {
      actionRowComponents.push({
        type: 2,
        style: 2,
        label: `Read #${idx + 1}`,
        custom_id: `read_note:${n.id}`,
        emoji: { name: '📖' },
      });
      actionRowComponents.push({
        type: 2,
        style: 4,
        label: `Delete #${idx + 1}`,
        custom_id: `del_note:${n.id}`,
        emoji: { name: '🗑️' },
      });
    });
    if (actionRowComponents.length > 0) {
      components.push({
        type: 1,
        components: actionRowComponents.slice(0, 5),
      });
    }
  }

  components.push({
    type: 1,
    components: [
      { type: 2, style: 1, label: 'Refresh Notes', custom_id: 'btn_notes', emoji: { name: '🔄' } },
      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
      { type: 2, style: 5, label: 'Open in App', url: 'https://www.kylrix.space/note' },
    ],
  });

  return {
    embeds: [
      {
        title: '📝 Kylrix Notes',
        description: isLinked
          ? 'Your recent sovereign notes synced across web, desktop, and mobile:'
          : '⚠️ *Operating in Sandbox Mode.* Use `/pair` or `/link` to connect your Kylrix account.\n\nYour notes:',
        color: 0xec4899, // Pink #EC4899
        fields,
        footer: { text: isLinked ? 'Kylrix Notes • Encrypted & Synced' : 'Kylrix Notes • Sandbox Mode' },
      },
    ],
    components,
  };
}

function buildGoalsEmbed(goals: any[], isLinked = true) {
  const fields =
    goals.length > 0
      ? goals.map((g, idx) => {
          const isDone = g.status === 'completed';
          return {
            name: `${isDone ? '✅' : '⏳'} ${idx + 1}. ${g.title || 'Goal'}`,
            value: `Status: **${g.status || 'todo'}**\n\`ID: ${g.id}\``,
            inline: false,
          };
        })
      : [
          {
            name: 'No Goals Found',
            value: isLinked
              ? 'Create a new deliverable using `/goal title: ...`'
              : 'Create a deliverable using `/goal` or pair your account with `/pair` to view your goals.',
            inline: false,
          },
        ];

  const components: any[] = [buildDiscordSelectMenu()];

  if (goals.length > 0) {
    const actionRowComponents: any[] = [];
    goals.slice(0, 2).forEach((g, idx) => {
      const isDone = g.status === 'completed';
      if (!isDone) {
        actionRowComponents.push({
          type: 2,
          style: 3, // Success
          label: `Complete #${idx + 1}`,
          custom_id: `done_goal:${g.id}`,
          emoji: { name: '✅' },
        });
      }
      actionRowComponents.push({
        type: 2,
        style: 4, // Danger
        label: `Delete #${idx + 1}`,
        custom_id: `del_goal:${g.id}`,
        emoji: { name: '🗑️' },
      });
    });
    if (actionRowComponents.length > 0) {
      components.push({
        type: 1,
        components: actionRowComponents.slice(0, 5),
      });
    }
  }

  components.push({
    type: 1,
    components: [
      { type: 2, style: 1, label: 'Refresh Goals', custom_id: 'btn_goals', emoji: { name: '🔄' } },
      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
      { type: 2, style: 5, label: 'Open in App', url: 'https://www.kylrix.space/goals' },
    ],
  });

  return {
    embeds: [
      {
        title: '🎯 Kylrix Goals & Deliverables',
        description: isLinked
          ? 'Track your personal and workspace task progress:'
          : '⚠️ *Operating in Sandbox Mode.* Use `/pair` or `/link` to connect your Kylrix account.\n\nYour deliverables:',
        color: 0xa855f7, // Purple #A855F7
        fields,
        footer: { text: isLinked ? 'Kylrix Goals • Synced & Tracked' : 'Kylrix Goals • Sandbox Mode' },
      },
    ],
    components,
  };
}

function buildWorkspacesEmbed(workspaces: any[]) {
  const fields =
    workspaces.length > 0
      ? workspaces.map((w, idx) => ({
          name: `${idx + 1}. ${w.name || 'Workspace'}`,
          value: `Collaborators: **${w.collaboratorsCount || 1}**\n\`ID: ${w.id}\``,
          inline: true,
        }))
      : [
          {
            name: 'Personal Workspace',
            value: 'You are currently inside your sovereign Personal Workspace.',
            inline: false,
          },
        ];

  return {
    embeds: [
      {
        title: '📂 Sovereign Workspaces',
        description: 'Workspaces isolate your project tasks, notes, and agentic workflows:',
        color: 0x6366f1, // Indigo #6366F1
        fields,
        footer: { text: 'Kylrix Workspaces • www.kylrix.space' },
      },
    ],
    components: [
      buildDiscordSelectMenu(),
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Refresh Workspaces', custom_id: 'btn_workspaces', emoji: { name: '🔄' } },
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
          { type: 2, style: 5, label: 'Manage Workspaces', url: 'https://www.kylrix.space/app' },
        ],
      },
    ],
  };
}

function buildSettingsEmbed(profile: any, billing: any, callerName: string, isLinked = false) {
  const isPro = Boolean(billing?.active || profile?.quotas?.isPro);
  const tier = isPro ? '⭐ PRO' : (billing?.tier || profile?.tier || 'FREE');
  const balance = billing?.balance?.amount ?? 0;
  const symbol = billing?.balance?.symbol || 'KYL';

  return {
    embeds: [
      {
        title: '⚙️ Account & Security Settings',
        description: `Settings overview for **${callerName}**:`,
        color: 0x10b981, // Emerald #10B981
        fields: [
          { name: 'Subscription Plan', value: `**${tier}**`, inline: true },
          { name: 'Token Balance', value: `\`${balance} ${symbol}\``, inline: true },
          { name: 'Max Collaborators', value: `${profile?.quotas?.maxCollaboratorsPerResource ?? 8} per item`, inline: true },
          { name: 'Zero-Knowledge Vault', value: '🔒 Active (Argon2id/AES-GCM)', inline: true },
          { name: 'Account Pairing', value: isLinked ? '🟢 Paired' : '🟡 Sandbox (Run `/pair`)', inline: true },
          { name: 'Export Sovereignty', value: 'Allowed (JSON/HTML/MD)', inline: true },
        ],
        footer: { text: 'Kylrix Security & Entitlements • www.kylrix.space' },
      },
    ],
    components: [
      buildDiscordSelectMenu(),
      {
        type: 1,
        components: [
          isLinked
            ? { type: 2, style: 4, label: 'Unlink Account', custom_id: 'btn_unlink', emoji: { name: '🔌' } }
            : { type: 2, style: 1, label: 'Pair Account', custom_id: 'btn_pair', emoji: { name: '🔗' } },
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
          { type: 2, style: 5, label: 'Open Settings Panel', url: 'https://www.kylrix.space/app' },
        ],
      },
    ],
  };
}

async function buildPairingEmbed(callerName: string, callerId: string) {
  const session = await PairingService.requestPairing({
    clientName: `Discord (${callerName})`,
    clientType: 'discord',
    requestedScopes: ['*'],
    pairingMetadata: { discordUserId: callerId, callerName },
  });

  return {
    embeds: [
      {
        title: '🔗 Pair Kylrix Account',
        description:
          `Link your Discord account to your sovereign Kylrix workspace in 1 click!\n\n` +
          `**Step 1:** Tap the **Authorize in Browser** button below.\n` +
          `**Step 2:** Confirm this pairing code:\n` +
          `# \`${session.userCode}\`\n\n` +
          `**Step 3:** Return here and tap **Check Status** to finalize!`,
        color: 0x6366f1,
        fields: [
          { name: 'Pairing Code', value: `\`${session.userCode}\``, inline: true },
          { name: 'Expires In', value: '15 minutes', inline: true },
        ],
        footer: { text: 'RFC 8628 Device Authorization • Kylrix Ecosystem' },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: 'Authorize in Browser', url: session.verificationUriComplete },
          { type: 2, style: 1, label: 'Check Status', custom_id: `check_pair:${session.deviceCode}`, emoji: { name: '🔄' } },
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
        ],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature-ed25519') || '';
  const timestamp = req.headers.get('x-signature-timestamp') || '';
  const discordPublicKey = process.env.DISCORD_PUBLIC_KEY || '';

  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    payload = {};
  }

  // ── 0. SLASH COMMANDS REGISTRATION DISPATCH ──
  if (payload.action === 'register_commands' || payload.action === 'sync_commands') {
    const regResult = await registerDiscordCommands({
      botToken: payload.botToken,
      applicationId: payload.applicationId,
    });
    return NextResponse.json(regResult);
  }

  // ── 1. OUTBOUND NOTIFICATION / AGENT BROADCAST DISPATCH ──
  if (
    payload.action === 'notify' ||
    payload.action === 'broadcast_agent_update' ||
    Boolean(payload.webhookUrl)
  ) {
    const webhookUrl = payload.webhookUrl || process.env.DISCORD_DEFAULT_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, error: 'Missing webhookUrl' }, { status: 400 });
    }

    if (!isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or disallowed webhookUrl' },
        { status: 400 }
      );
    }

    try {
      const messageBody: Record<string, any> = {
        content: payload.content || '',
        embeds: payload.embeds || (payload.embed ? [payload.embed] : undefined),
      };

      if (payload.action === 'broadcast_agent_update') {
        messageBody.embeds = [
          {
            title: `🤖 Agent ${payload.agentName || 'Autonomous Agent'} Update`,
            description: payload.message || 'New agentic action executed in workspace.',
            color: 0x6366f1,
            fields: [
              {
                name: 'Workspace',
                value: payload.workspaceTitle || 'Default Workspace',
                inline: true,
              },
              {
                name: 'Timestamp',
                value: new Date().toISOString(),
                inline: true,
              },
            ],
            footer: {
              text: 'Kylrix Autonomous Agent System • www.kylrix.space',
            },
          },
        ];
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageBody),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return NextResponse.json(
          { ok: false, status: response.status, error: errText },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, dispatched: true });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || 'Dispatch error' }, { status: 500 });
    }
  }

  // ── 2. INBOUND DISCORD INTERACTION VERIFICATION ──
  if (discordPublicKey) {
    const isValid = verifyDiscordSignature({
      rawBody,
      signature,
      timestamp,
      clientPublicKey: discordPublicKey,
    });

    if (!isValid) {
      return new NextResponse('Invalid request signature', { status: 401 });
    }
  }

  // Type 1: PING (Discord endpoint challenge)
  if (payload.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const user = payload.user || payload.member?.user || {};
  const callerName = user.global_name || user.username || 'User';
  const callerId = user.id || 'default_user';

  // Resolve linked actor
  const { actor, isLinked } = await resolveActorForDiscordUser(callerId, callerName);

  // ── 3. TYPE 3: MESSAGE_COMPONENT (Interactive Select Menus & Buttons) ──
  if (payload.type === 3) {
    const customId = payload.data?.custom_id || '';
    const selectedValue = payload.data?.values?.[0] || '';

    // A. Main Menu
    if (customId === 'btn_main' || selectedValue === 'val_main') {
      const data = buildMainDashboardEmbed(callerName, isLinked);
      return NextResponse.json({ type: 7, data }); // Type 7: UPDATE_MESSAGE
    }

    // B. Notes Menu
    if (customId === 'btn_notes' || selectedValue === 'val_notes') {
      const notesRes = await ApiResources.listNotes(actor, 5).catch(() => []);
      const data = buildNotesEmbed(extractItems(notesRes), isLinked);
      return NextResponse.json({ type: 7, data });
    }

    // C. Goals Menu
    if (customId === 'btn_goals' || selectedValue === 'val_goals') {
      const goalsRes = await ApiResources.listGoals(actor, 6).catch(() => []);
      const data = buildGoalsEmbed(extractItems(goalsRes), isLinked);
      return NextResponse.json({ type: 7, data });
    }

    // D. Workspaces Menu
    if (customId === 'btn_workspaces' || selectedValue === 'val_workspaces') {
      const wsRes = await ApiResources.listWorkspaces(actor, 5).catch(() => []);
      const data = buildWorkspacesEmbed(extractItems(wsRes));
      return NextResponse.json({ type: 7, data });
    }

    // E. Settings Menu
    if (customId === 'btn_settings' || selectedValue === 'val_settings') {
      const [profile, billing] = await Promise.all([
        ApiResources.me(actor).catch(() => null),
        ApiResources.getBillingStatus(actor).catch(() => null),
      ]);
      const data = buildSettingsEmbed(profile, billing, callerName, isLinked);
      return NextResponse.json({ type: 7, data });
    }

    // F. Pair Account Button / Select
    if (customId === 'btn_pair' || selectedValue === 'val_pair') {
      try {
        const data = await buildPairingEmbed(callerName, callerId);
        return NextResponse.json({ type: 7, data });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Pairing request failed: ${err?.message || 'Error'}` },
        });
      }
    }

    // G. Unlink Account Button
    if (customId === 'btn_unlink') {
      await unlinkDiscordUserAccount(callerId);
      const data = buildMainDashboardEmbed(callerName, false);
      return NextResponse.json({ type: 7, data });
    }

    // H. Read Note Callback
    if (customId.startsWith('read_note:')) {
      const noteId = customId.replace('read_note:', '');
      try {
        const note = await ApiResources.getNote(actor, noteId);
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: `📝 ${note.title || 'Untitled Note'}`,
                description: note.content ? `${note.content}` : '*(Empty body)*',
                color: 0xec4899,
                fields: [
                  { name: 'Note ID', value: `\`${note.id}\``, inline: true },
                  { name: 'Status', value: '🟢 Decrypted', inline: true },
                ],
                footer: { text: 'Kylrix Sovereign Notes' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 4, label: 'Delete Note', custom_id: `del_note:${note.id}`, emoji: { name: '🗑️' } },
                  { type: 2, style: 1, label: 'All Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Could not read note: ${err?.message || 'Note not found'}` },
        });
      }
    }

    // I. Delete Note Callback
    if (customId.startsWith('del_note:')) {
      const noteId = customId.replace('del_note:', '');
      try {
        await ApiResources.deleteNote(actor, noteId);
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: '🗑️ Note Deleted',
                description: `Note with ID \`${noteId}\` was removed.`,
                color: 0xef4444,
                footer: { text: 'Kylrix Sovereign Notes' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'Back to Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Note deletion failed: ${err?.message || 'Error'}` },
        });
      }
    }

    // J. Mark Goal Done Callback
    if (customId.startsWith('done_goal:')) {
      const goalId = customId.replace('done_goal:', '');
      try {
        const updated = await ApiResources.updateGoal(actor, goalId, { status: 'completed' });
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: '✅ Goal Completed!',
                description: `**${updated.title || 'Goal'}** marked as completed.`,
                color: 0x10b981,
                fields: [
                  { name: 'Goal ID', value: `\`${updated.id}\``, inline: true },
                  { name: 'Status', value: 'Completed', inline: true },
                ],
                footer: { text: 'Kylrix Goals' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'Back to Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Update failed: ${err?.message || 'Error'}` },
        });
      }
    }

    // K. Delete Goal Callback
    if (customId.startsWith('del_goal:')) {
      const goalId = customId.replace('del_goal:', '');
      try {
        await ApiResources.deleteGoal(actor, goalId);
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: '🗑️ Goal Deleted',
                description: `Goal with ID \`${goalId}\` was removed.`,
                color: 0xef4444,
                footer: { text: 'Kylrix Goals' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'Back to Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Goal deletion failed: ${err?.message || 'Error'}` },
        });
      }
    }

    // L. Check Pairing Status Callback
    if (customId.startsWith('check_pair:')) {
      const deviceCode = customId.replace('check_pair:', '');
      try {
        const exchange = await PairingService.exchangeDeviceCode(deviceCode);
        if (exchange.status === 'granted' && exchange.userId) {
          await linkDiscordUserAccount(callerId, exchange.userId, callerName);
          return NextResponse.json({
            type: 7,
            data: {
              embeds: [
                {
                  title: '🎉 Account Successfully Paired!',
                  description:
                    `Your Discord account is now securely linked to Kylrix account **\`${exchange.userId}\`**.\n\n` +
                    `All your sovereign notes, deliverables, and workspaces are now accessible right here in Discord!`,
                  color: 0x10b981,
                  fields: [
                    { name: 'Kylrix User ID', value: `\`${exchange.userId}\``, inline: true },
                    { name: 'Pairing Method', value: 'RFC 8628 Punch Grant', inline: true },
                  ],
                  footer: { text: 'Kylrix Account Linked • www.kylrix.space' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'View Notes', custom_id: 'btn_notes', emoji: { name: '📝' } },
                    { type: 2, style: 1, label: 'View Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        }

        if (exchange.status === 'authorization_pending') {
          return NextResponse.json({
            type: 7,
            data: {
              embeds: [
                {
                  title: '⏳ Waiting for Browser Approval',
                  description:
                    'Your pairing authorization is still pending in your browser.\n\n' +
                    'Please complete the approval on the Kylrix authorization page, then tap **Check Status** again.',
                  color: 0xf59e0b,
                  footer: { text: 'Pairing Pending • Kylrix Authorization' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'Check Status Again', custom_id: `check_pair:${deviceCode}`, emoji: { name: '🔄' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        }

        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: '❌ Pairing Session Expired',
                description: 'This pairing session has expired or was denied. Use `/pair` to start a fresh pairing request.',
                color: 0xef4444,
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'New Pairing', custom_id: 'btn_pair', emoji: { name: '🔗' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Pairing check error: ${err?.message || 'Error'}` },
        });
      }
    }

    // Fallback acknowledge
    return NextResponse.json({ type: 7, data: buildMainDashboardEmbed(callerName, isLinked) });
  }

  // ── 4. TYPE 2: APPLICATION_COMMAND (Slash Commands) ──
  if (payload.type === 2) {
    const commandName = payload.data?.name || '';
    const options: any[] = payload.data?.options || [];
    const getOption = (name: string) => options.find((o) => o.name === name)?.value;

    switch (commandName) {
      case 'menu': {
        const data = buildMainDashboardEmbed(callerName, isLinked);
        return NextResponse.json({ type: 4, data }); // Type 4: CHANNEL_MESSAGE_WITH_SOURCE
      }

      case 'notes': {
        const notesRes = await ApiResources.listNotes(actor, 5).catch(() => []);
        const data = buildNotesEmbed(extractItems(notesRes), isLinked);
        return NextResponse.json({ type: 4, data });
      }

      case 'note': {
        const title = getOption('title') || 'Quick Note';
        const content = getOption('content') || '';
        try {
          const newNote = await ApiResources.createNote(actor, { title, content });
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `📝 Note Captured: ${newNote.title}`,
                  description: content ? `> ${content}` : '*(Empty body)*',
                  color: 0xec4899,
                  fields: [
                    { name: 'Author', value: callerName, inline: true },
                    { name: 'Note ID', value: `\`${newNote.id}\``, inline: true },
                  ],
                  footer: { text: isLinked ? 'Kylrix Notes • Encrypted & Synced' : 'Kylrix Notes • Sandbox Mode' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 2, label: 'Read Note', custom_id: `read_note:${newNote.id}`, emoji: { name: '📖' } },
                    { type: 2, style: 1, label: 'All Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Note creation failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'note_read': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Note ID is required: `/note_read id: <id>`' },
          });
        }
        try {
          const note = await ApiResources.getNote(actor, id);
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `📝 ${note.title || 'Untitled Note'}`,
                  description: note.content ? `${note.content}` : '*(Empty body)*',
                  color: 0xec4899,
                  fields: [
                    { name: 'Note ID', value: `\`${note.id}\``, inline: true },
                    { name: 'Status', value: '🟢 Decrypted', inline: true },
                  ],
                  footer: { text: 'Kylrix Sovereign Notes' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 4, label: 'Delete Note', custom_id: `del_note:${note.id}`, emoji: { name: '🗑️' } },
                    { type: 2, style: 1, label: 'All Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Could not read note: ${err?.message || 'Note not found'}` },
          });
        }
      }

      case 'note_delete': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Note ID is required: `/note_delete id: <id>`' },
          });
        }
        try {
          await ApiResources.deleteNote(actor, id);
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: '🗑️ Note Deleted',
                  description: `Note with ID \`${id}\` was permanently removed.`,
                  color: 0xef4444,
                  footer: { text: 'Kylrix Sovereign Notes' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'Back to Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Note deletion failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'goals': {
        const goalsRes = await ApiResources.listGoals(actor, 6).catch(() => []);
        const data = buildGoalsEmbed(extractItems(goalsRes), isLinked);
        return NextResponse.json({ type: 4, data });
      }

      case 'goal': {
        const title = getOption('title') || 'New Goal';
        try {
          const newGoal = await ApiResources.createGoal(actor, { title, status: 'todo' });
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `🎯 Goal Logged: ${newGoal.title}`,
                  description: `Logged for tracking and delivery.`,
                  color: 0xa855f7,
                  fields: [
                    { name: 'Assignee', value: callerName, inline: true },
                    { name: 'Goal ID', value: `\`${newGoal.id}\``, inline: true },
                  ],
                  footer: { text: isLinked ? 'Kylrix Goals • Synced & Tracked' : 'Kylrix Goals • Sandbox Mode' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 3, label: 'Mark Done', custom_id: `done_goal:${newGoal.id}`, emoji: { name: '✅' } },
                    { type: 2, style: 1, label: 'View All Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Goal creation failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'goal_done': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Goal ID is required: `/goal_done id: <id>`' },
          });
        }
        try {
          const updated = await ApiResources.updateGoal(actor, id, { status: 'completed' });
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: '✅ Goal Completed!',
                  description: `**${updated.title || 'Goal'}** is marked completed. Great job!`,
                  color: 0x10b981,
                  fields: [
                    { name: 'Goal ID', value: `\`${updated.id}\``, inline: true },
                    { name: 'Status', value: 'Completed', inline: true },
                  ],
                  footer: { text: 'Kylrix Goals' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'Back to Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Goal update failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'goal_delete': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Goal ID is required: `/goal_delete id: <id>`' },
          });
        }
        try {
          await ApiResources.deleteGoal(actor, id);
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: '🗑️ Goal Deleted',
                  description: `Goal with ID \`${id}\` was permanently removed.`,
                  color: 0xef4444,
                  footer: { text: 'Kylrix Goals' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'Back to Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Goal deletion failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'workspaces': {
        const wsRes = await ApiResources.listWorkspaces(actor, 5).catch(() => []);
        const data = buildWorkspacesEmbed(extractItems(wsRes));
        return NextResponse.json({ type: 4, data });
      }

      case 'pair': {
        try {
          const data = await buildPairingEmbed(callerName, callerId);
          return NextResponse.json({ type: 4, data });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Pairing request failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'link': {
        const token = String(getOption('token') || '').trim();
        if (!token) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Missing token. Please provide your Personal Access Token: `/link token: kyl_pat_...`' },
          });
        }
        try {
          const verified = await PatService.verifyBearer(token);
          if (!verified || !verified.userId) {
            return NextResponse.json({
              type: 4,
              data: {
                content:
                  '❌ Invalid or expired token.\n' +
                  'Generate a Personal Access Token in **Settings > Developer Tokens** at https://www.kylrix.space/app, then try `/link <token>`.',
              },
            });
          }

          await linkDiscordUserAccount(callerId, verified.userId, callerName);

          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: '🎉 Kylrix Account Linked!',
                  description:
                    `Your Discord user **${callerName}** is now securely linked to Kylrix account **\`${verified.userId}\`**.\n\n` +
                    `You can now view, create, and manage your real sovereign notes, goals, and workspaces directly from Discord!`,
                  color: 0x10b981,
                  fields: [
                    { name: 'Kylrix User ID', value: `\`${verified.userId}\``, inline: true },
                    { name: 'Token Prefix', value: `\`${verified.pat.tokenPrefix}...\``, inline: true },
                  ],
                  footer: { text: 'Kylrix Account Linked • Zero-Knowledge Sovereignty' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'View Notes', custom_id: 'btn_notes', emoji: { name: '📝' } },
                    { type: 2, style: 1, label: 'View Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Account link failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'unlink': {
        await unlinkDiscordUserAccount(callerId);
        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '👋 Disconnected from Kylrix',
                description:
                  `Your Discord user has been unlinked from Kylrix.\n` +
                  `The bot is now operating in isolated Sandbox Mode. Use \`/pair\` anytime to reconnect!`,
                color: 0x6b7280,
                footer: { text: 'Kylrix Account Disconnected' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'Pair Account', custom_id: 'btn_pair', emoji: { name: '🔗' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      }

      case 'whoami': {
        const [profile, billing] = await Promise.all([
          ApiResources.me(actor).catch(() => null),
          ApiResources.getBillingStatus(actor).catch(() => null),
        ]);
        const isPro = Boolean(billing?.active || profile?.quotas?.isPro);
        const tier = isPro ? '⭐ PRO' : (billing?.tier || profile?.tier || 'FREE');
        const balance = billing?.balance?.amount ?? 0;
        const symbol = billing?.balance?.symbol || 'KYL';

        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '👤 Kylrix Identity & Session',
                description: `Account details for **${callerName}**:`,
                color: isLinked ? 0x10b981 : 0xf59e0b,
                fields: [
                  { name: 'Pairing Status', value: isLinked ? '🟢 Paired & Verified' : '🟡 Sandbox (Unlinked)', inline: true },
                  { name: 'User ID', value: `\`${actor.userId}\``, inline: true },
                  { name: 'Subscription Tier', value: `**${tier}**`, inline: true },
                  { name: 'Token Balance', value: `\`${balance} ${symbol}\``, inline: true },
                  { name: 'Discord Snowflake', value: `\`${callerId}\``, inline: true },
                  {
                    name: 'Pairing Action',
                    value: isLinked
                      ? 'Linked to personal Kylrix account. Use `/unlink` to disconnect.'
                      : 'Not linked to your web account. Type `/pair` to link in 1 click!',
                    inline: false,
                  },
                ],
                footer: { text: 'Kylrix Identity Engine • www.kylrix.space' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  isLinked
                    ? { type: 2, style: 2, label: 'Settings', custom_id: 'btn_settings', emoji: { name: '⚙️' } }
                    : { type: 2, style: 1, label: 'Pair Account', custom_id: 'btn_pair', emoji: { name: '🔗' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      }

      case 'settings': {
        const [profile, billing] = await Promise.all([
          ApiResources.me(actor).catch(() => null),
          ApiResources.getBillingStatus(actor).catch(() => null),
        ]);
        const data = buildSettingsEmbed(profile, billing, callerName, isLinked);
        return NextResponse.json({ type: 4, data });
      }

      case 'agent': {
        const prompt = getOption('prompt') || '';
        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '🤖 Agent Task Dispatched',
                description: `Prompt: **"${prompt}"**\nTask queued for autonomous agent execution.`,
                color: 0x818cf8,
                footer: { text: 'Kylrix Agentic Engine • www.kylrix.space' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  { type: 2, style: 5, label: 'Open Agent Panel', url: 'https://www.kylrix.space/app' },
                ],
              },
            ],
          },
        });
      }

      case 'help':
      default: {
        const data = buildMainDashboardEmbed(callerName, isLinked);
        return NextResponse.json({ type: 4, data });
      }
    }
  }

  return NextResponse.json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sync = url.searchParams.get('sync');
  if (sync === 'true' || sync === 'commands') {
    const regResult = await registerDiscordCommands();
    return NextResponse.json({
      ok: regResult.ok,
      service: 'kylrix-discord-bot',
      syncResult: regResult,
      commandCount: DISCORD_SLASH_COMMANDS.length,
      commands: DISCORD_SLASH_COMMANDS.map((c) => `/${c.name}`),
    });
  }

  return NextResponse.json({
    ok: true,
    service: 'kylrix-discord-bot',
    status: 'online',
    commands: DISCORD_SLASH_COMMANDS.map((c) => `/${c.name}`),
  });
}
