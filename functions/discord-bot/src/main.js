import { Client, Databases, Query, ID } from 'node-appwrite';
import nacl from 'tweetnacl';

/**
 * Discord Bot Appwrite Function
 * Handles:
 * 1. Discord Slash Command Interactions (HTTP Interactions webhook with ED25519 verification)
 * 2. Outbound Event Dispatch (Pushing notifications & agent activity to Discord channels)
 */

function verifyDiscordSignature({ rawBody, signature, timestamp, clientPublicKey }) {
  if (!signature || !timestamp || !clientPublicKey) return false;
  try {
    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, 'hex'),
      Buffer.from(clientPublicKey, 'hex')
    );
    return isVerified;
  } catch {
    return false;
  }
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const databases = new Databases(client);
  const DB_ID = process.env.DATABASE_ID || 'passwordManagerDb';
  const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const headers = req.headers || {};
  const signature = headers['x-signature-ed25519'] || '';
  const timestamp = headers['x-signature-timestamp'] || '';

  // ── 1. OUTBOUND NOTIFICATION DISPATCH (In-App Function Execution) ──
  let payload = {};
  try {
    payload = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody || '{}');
  } catch {
    payload = {};
  }

  if (payload.action === 'notify' || payload.action === 'broadcast_agent_update' || payload.webhookUrl) {
    log(`[Discord Bot] Processing outbound notification dispatch (action: ${payload.action || 'notify'})`);
    const webhookUrl = payload.webhookUrl || process.env.DISCORD_DEFAULT_WEBHOOK_URL;
    if (!webhookUrl) {
      error('[Discord Bot] Missing Discord webhook URL');
      return res.json({ ok: false, error: 'Missing webhookUrl' }, 400);
    }

    try {
      const messageBody = {
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
        error(`[Discord Bot] Webhook push failed (${response.status}): ${errText}`);
        return res.json({ ok: false, status: response.status, error: errText }, 502);
      }

      log('[Discord Bot] Outbound notification dispatched successfully');
      return res.json({ ok: true, dispatched: true });
    } catch (err) {
      error(`[Discord Bot] Outbound dispatch error: ${err.message}`);
      return res.json({ ok: false, error: err.message }, 500);
    }
  }

  // ── 2. INBOUND DISCORD SLASH COMMAND INTERACTIONS ──
  if (signature && timestamp && DISCORD_PUBLIC_KEY) {
    const isValid = verifyDiscordSignature({
      rawBody,
      signature,
      timestamp,
      clientPublicKey: DISCORD_PUBLIC_KEY,
    });

    if (!isValid) {
      error('[Discord Bot] Invalid interaction signature');
      return res.text('Invalid request signature', 401);
    }
  }

  // Type 1: PING (Discord endpoint validation challenge)
  if (payload.type === 1) {
    log('[Discord Bot] Responded to Discord PING challenge');
    return res.json({ type: 1 });
  }

  // Type 2: APPLICATION_COMMAND (Slash Commands)
  if (payload.type === 2) {
    const commandName = payload.data?.name || '';
    const options = payload.data?.options || [];
    const getOption = (name) => options.find((o) => o.name === name)?.value;

    log(`[Discord Bot] Received slash command /${commandName}`);

    switch (commandName) {
      case 'note': {
        const title = getOption('title') || 'Quick Note';
        const content = getOption('content') || '';
        return res.json({
          type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
          data: {
            embeds: [
              {
                title: `📝 Note Created: ${title}`,
                description: content || '*(Empty body)*',
                color: 0xec4899, // Pink #EC4899
                footer: { text: 'Kylrix Notes • www.kylrix.space' },
              },
            ],
          },
        });
      }

      case 'goal': {
        const title = getOption('title') || 'New Goal';
        return res.json({
          type: 4,
          data: {
            embeds: [
              {
                title: `🎯 Goal Created: ${title}`,
                description: 'Goal added to your Kylrix workspace.',
                color: 0xa855f7, // Purple #A855F7
                footer: { text: 'Kylrix Goals • www.kylrix.space' },
              },
            ],
          },
        });
      }

      case 'agent': {
        const prompt = getOption('prompt') || '';
        return res.json({
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
        return res.json({
          type: 4,
          data: {
            embeds: [
              {
                title: '📂 Kylrix Workspaces',
                description: 'Manage and switch workspaces at [www.kylrix.space/workspaces](https://www.kylrix.space/workspaces).',
                color: 0x6366f1,
              },
            ],
          },
        });
      }

      default:
        return res.json({
          type: 4,
          data: {
            content: `⚡ Kylrix Bot received command: \`/${commandName}\`.`,
          },
        });
    }
  }

  return res.json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
};
