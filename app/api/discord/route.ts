import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

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
            color: 0x6366f1, // Indigo #6366F1
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

  // Type 2: APPLICATION_COMMAND (Slash Commands for Guilds & User Apps)
  if (payload.type === 2) {
    const commandName = payload.data?.name || '';
    const options: any[] = payload.data?.options || [];
    const getOption = (name: string) => options.find((o) => o.name === name)?.value;

    const user = payload.user || payload.member?.user || {};
    const callerName = user.global_name || user.username || 'User';

    switch (commandName) {
      case 'note': {
        const title = getOption('title') || 'Quick Note';
        const content = getOption('content') || '';
        return NextResponse.json({
          type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
          data: {
            embeds: [
              {
                title: `📝 Note Captured: ${title}`,
                description: content ? `> ${content}` : '*(Empty body)*',
                color: 0xec4899, // Pink #EC4899
                fields: [
                  { name: 'Author', value: callerName, inline: true },
                  { name: 'Storage', value: 'Kylrix Sync Cloud', inline: true },
                ],
                footer: { text: 'Kylrix Notes • www.kylrix.space' },
              },
            ],
          },
        });
      }

      case 'goal': {
        const title = getOption('title') || 'New Goal';
        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: `🎯 Goal Logged: ${title}`,
                description: `Goal logged by ${callerName} for workspace tracking.`,
                color: 0xa855f7, // Purple #A855F7
                footer: { text: 'Kylrix Goals • www.kylrix.space' },
              },
            ],
          },
        });
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
                color: 0x818cf8, // Indigo Light #818CF8
                footer: { text: 'Kylrix Agentic Engine • www.kylrix.space' },
              },
            ],
          },
        });
      }

      case 'workspaces': {
        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '📂 Kylrix Workspaces',
                description:
                  'View and organize your sovereign workspaces at [www.kylrix.space/app](https://www.kylrix.space/app).',
                color: 0x6366f1,
              },
            ],
          },
        });
      }

      case 'help':
      default: {
        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '⚡ Kylrix Discord Assistant',
                description:
                  'Manage and capture your ideas directly from Discord (supported in servers and user apps):\n\n' +
                  '• `/note [title] [content]` - Instant note capture\n' +
                  '• `/goal [title]` - Log a new workspace goal\n' +
                  '• `/agent [prompt]` - Dispatch an autonomous agent task\n' +
                  '• `/workspaces` - View workspace overview',
                color: 0x6366f1,
                footer: { text: 'Kylrix Ecosystem • www.kylrix.space' },
              },
            ],
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'kylrix-discord-bot', status: 'online' });
}
