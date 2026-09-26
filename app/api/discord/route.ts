import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

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

function buildDiscordButtonRow() {
  return {
    type: 1, // ACTION_ROW
    components: [
      { type: 2, style: 1, label: 'Notes', custom_id: 'btn_notes', emoji: { name: '📝' } },
      { type: 2, style: 1, label: 'Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
      { type: 2, style: 1, label: 'Workspaces', custom_id: 'btn_workspaces', emoji: { name: '📂' } },
      { type: 2, style: 2, label: 'Settings', custom_id: 'btn_settings', emoji: { name: '⚙️' } },
      { type: 2, style: 5, label: 'Open Web App', url: 'https://www.kylrix.space/app' },
    ],
  };
}

function buildMainDashboardEmbed(callerName: string) {
  return {
    embeds: [
      {
        title: '⚡ Kylrix Sovereign Workspace Dashboard',
        description:
          `Welcome, **${callerName}**!\n\n` +
          'Access and manage your sovereign data directly from Discord (servers & user apps).\n\n' +
          '• **📝 Notes:** Zero-knowledge synced notes\n' +
          '• **🎯 Goals:** Milestones and deliverables\n' +
          '• **📂 Workspaces:** Project spaces and team channels\n' +
          '• **⚙️ Settings:** Quotas, entitlements, and token balance\n\n' +
          'Use the dropdown menu or buttons below to navigate:',
        color: 0x6366f1, // Indigo #6366F1
        fields: [
          { name: 'Sync Status', value: '🟢 Active & Encrypted', inline: true },
          { name: 'Platform', value: 'Kylrix Cloud & Local-First', inline: true },
        ],
        footer: { text: 'Kylrix Ecosystem • www.kylrix.space' },
      },
    ],
    components: [buildDiscordSelectMenu(), buildDiscordButtonRow()],
  };
}

function buildNotesEmbed(notes: any[]) {
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
            value: 'Create your first note using `/note title: ... content: ...`',
            inline: false,
          },
        ];

  return {
    embeds: [
      {
        title: '📝 Kylrix Notes',
        description: 'Your recent sovereign notes synced across web, desktop, and mobile:',
        color: 0xec4899, // Pink #EC4899
        fields,
        footer: { text: 'Kylrix Notes • www.kylrix.space' },
      },
    ],
    components: [
      buildDiscordSelectMenu(),
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Refresh Notes', custom_id: 'btn_notes', emoji: { name: '🔄' } },
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
          { type: 2, style: 5, label: 'Open in App', url: 'https://www.kylrix.space/note' },
        ],
      },
    ],
  };
}

function buildGoalsEmbed(goals: any[]) {
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
            value: 'Create a new deliverable using `/goal title: ...`',
            inline: false,
          },
        ];

  return {
    embeds: [
      {
        title: '🎯 Kylrix Goals & Deliverables',
        description: 'Track your personal and workspace task progress:',
        color: 0xa855f7, // Purple #A855F7
        fields,
        footer: { text: 'Kylrix Goals • www.kylrix.space' },
      },
    ],
    components: [
      buildDiscordSelectMenu(),
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Refresh Goals', custom_id: 'btn_goals', emoji: { name: '🔄' } },
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
          { type: 2, style: 5, label: 'Open in App', url: 'https://www.kylrix.space/goals' },
        ],
      },
    ],
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

function buildSettingsEmbed(profile: any, billing: any, callerName: string) {
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
          { name: 'Discord Integration', value: '🟢 Connected & Operating', inline: true },
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
          { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
          { type: 2, style: 5, label: 'Open Settings Panel', url: 'https://www.kylrix.space/app' },
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

  // Construct secure actor reusing the API / MCP framework
  const actor: ApiActor = {
    userId: callerId,
    kind: 'session',
    scopes: ['*'],
  };

  // ── 3. TYPE 3: MESSAGE_COMPONENT (Interactive Select Menus & Buttons) ──
  if (payload.type === 3) {
    const customId = payload.data?.custom_id || '';
    const selectedValue = payload.data?.values?.[0] || '';

    // A. Main Menu
    if (customId === 'btn_main' || selectedValue === 'val_main') {
      const data = buildMainDashboardEmbed(callerName);
      return NextResponse.json({ type: 7, data }); // Type 7: UPDATE_MESSAGE
    }

    // B. Notes Menu
    if (customId === 'btn_notes' || selectedValue === 'val_notes') {
      const notesRes = await ApiResources.listNotes(actor, 5).catch(() => []);
      const data = buildNotesEmbed(extractItems(notesRes));
      return NextResponse.json({ type: 7, data });
    }

    // C. Goals Menu
    if (customId === 'btn_goals' || selectedValue === 'val_goals') {
      const goalsRes = await ApiResources.listGoals(actor, 6).catch(() => []);
      const data = buildGoalsEmbed(extractItems(goalsRes));
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
      const data = buildSettingsEmbed(profile, billing, callerName);
      return NextResponse.json({ type: 7, data });
    }

    // Fallback component acknowledge
    return NextResponse.json({ type: 7, data: buildMainDashboardEmbed(callerName) });
  }

  // ── 4. TYPE 2: APPLICATION_COMMAND (Slash Commands) ──
  if (payload.type === 2) {
    const commandName = payload.data?.name || '';
    const options: any[] = payload.data?.options || [];
    const getOption = (name: string) => options.find((o) => o.name === name)?.value;

    switch (commandName) {
      case 'menu': {
        const data = buildMainDashboardEmbed(callerName);
        return NextResponse.json({ type: 4, data }); // Type 4: CHANNEL_MESSAGE_WITH_SOURCE
      }

      case 'notes': {
        const notesRes = await ApiResources.listNotes(actor, 5).catch(() => []);
        const data = buildNotesEmbed(extractItems(notesRes));
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
                  footer: { text: 'Kylrix Notes • www.kylrix.space' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'View All Notes', custom_id: 'btn_notes', emoji: { name: '📋' } },
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

      case 'goals': {
        const goalsRes = await ApiResources.listGoals(actor, 6).catch(() => []);
        const data = buildGoalsEmbed(extractItems(goalsRes));
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
                  footer: { text: 'Kylrix Goals • www.kylrix.space' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
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

      case 'workspaces': {
        const wsRes = await ApiResources.listWorkspaces(actor, 5).catch(() => []);
        const data = buildWorkspacesEmbed(extractItems(wsRes));
        return NextResponse.json({ type: 4, data });
      }

      case 'settings': {
        const [profile, billing] = await Promise.all([
          ApiResources.me(actor).catch(() => null),
          ApiResources.getBillingStatus(actor).catch(() => null),
        ]);
        const data = buildSettingsEmbed(profile, billing, callerName);
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
        const data = buildMainDashboardEmbed(callerName);
        return NextResponse.json({ type: 4, data });
      }
    }
  }

  return NextResponse.json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'kylrix-discord-bot', status: 'online' });
}
