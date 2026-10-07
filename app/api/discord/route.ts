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

// Discord Contexts: 0 = GUILD, 1 = BOT_DM, 2 = PRIVATE_CHANNEL (DMs/Group DMs)
// Integration Types: 0 = GUILD_INSTALL, 1 = USER_INSTALL
const DEFAULT_COMMAND_SETTINGS = {
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

export const DISCORD_SLASH_COMMANDS = [
  {
    name: 'menu',
    description: 'Open the interactive Kylrix workspace dashboard',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'help',
    description: 'Display Kylrix Discord bot command guide and instructions',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'ideas',
    description: 'View and manage your recent sovereign ideas',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'idea',
    description: 'Create a new sovereign idea',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'title',
        description: 'The title of your idea',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'content',
        description: 'Optional idea body or details',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'save',
    description: 'Save previous message, tagged message, or text as an idea',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'message',
        description: 'Optional text or message link (defaults to previous message in channel)',
        type: 3, // STRING
        required: false,
      },
      {
        name: 'title',
        description: 'Optional custom title (defaults to snippet of content)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'Save as Idea',
    type: 3, // MESSAGE context menu command
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'Save & Share',
    type: 3, // MESSAGE context menu command
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'idea_read',
    description: 'Read an idea by ID or title snippet',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'id',
        description: 'The ID or title snippet of the idea to read',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'idea_delete',
    description: 'Delete an idea by ID or title snippet',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'id',
        description: 'The ID or title snippet of the idea to delete',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'goals',
    description: 'View and track deliverables and goal milestones',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'goal',
    description: 'Create a new deliverable or goal',
    ...DEFAULT_COMMAND_SETTINGS,
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
    description: 'Mark a goal completed by ID or title snippet',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'id',
        description: 'The ID or title snippet of the goal to mark completed',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'goal_delete',
    description: 'Delete a goal by ID or title snippet',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'id',
        description: 'The ID or title snippet of the goal to delete',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'workspaces',
    description: 'List your sovereign workspaces and team projects',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'pair',
    description: 'Pair this Discord account with Kylrix via 1-click device authorization',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'link',
    description: 'Link your Kylrix account using a Personal Access Token (PAT)',
    ...DEFAULT_COMMAND_SETTINGS,
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
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'whoami',
    description: 'Check current linked Kylrix account, subscription tier, and status',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'settings',
    description: 'View subscription plan, token balance, and security settings',
    ...DEFAULT_COMMAND_SETTINGS,
  },
  {
    name: 'agent',
    description: 'Dispatch an autonomous AI agent task to your workspace',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'prompt',
        description: 'Task instructions for the autonomous agent',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'search',
    description: 'Quickly search ideas, deliverables, and workspace items',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'query',
        description: 'Keyword to search across your workspace',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'share',
    description: 'Generate web link for an item, or save & share tagged message',
    ...DEFAULT_COMMAND_SETTINGS,
    options: [
      {
        name: 'item',
        description: 'Item ID, title query, or text (optional: defaults to tagged/previous message)',
        type: 3, // STRING
        required: false,
      },
      {
        name: 'kind',
        description: 'Optional filter by type (idea, goal, workspace, vault)',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'Idea', value: 'idea' },
          { name: 'Goal', value: 'goal' },
          { name: 'Workspace', value: 'workspace' },
          { name: 'Vault Secret (Link)', value: 'vault' },
        ],
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

export function extractTitleSnippet(content: string, maxLen = 60): string {
  if (!content || !content.trim()) return 'Quick Idea';
  const lines = content.trim().split('\n');
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || content;
  let cleaned = firstNonEmpty
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/^[#>\-\*\d\.\s]+/, '')
    .replace(/[`*_~[\]()]/g, '')
    .trim();

  if (!cleaned) cleaned = 'Quick Idea';
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trim() + '...';
}

export interface WorkspaceItemMatch {
  id: string;
  title: string;
  kind: 'idea' | 'goal' | 'workspace' | 'vault';
  kindTitle: string;
  kindKey: string;
  emoji: { name: string };
  emojiChar: string;
  shareUrl: string;
  preview?: string;
  score: number;
}

export function computeFuzzyMatchScore(
  itemTitle: string,
  itemContent: string,
  query: string,
  itemId: string
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const title = (itemTitle || '').trim().toLowerCase();
  const content = (itemContent || '').trim().toLowerCase();
  const idLower = (itemId || '').toLowerCase();

  // 1. Exact ID match
  if (idLower === q) return 1000;
  if (idLower.includes(q) && q.length >= 4) return 800;

  // 2. Exact Title
  if (title === q) return 600;

  // 3. Title starts with query
  if (title.startsWith(q)) return 400;

  // 4. Title contains whole query
  if (title.includes(q)) return 300;

  // 5. Query tokens in title / content
  const tokens = q.split(/[\s_\-\/]+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;

  let score = 0;
  let allInTitle = true;
  let matchedTokens = 0;

  for (const token of tokens) {
    if (title.includes(token)) {
      matchedTokens++;
      score += 50;
    } else {
      allInTitle = false;
      if (content.includes(token)) {
        matchedTokens++;
        score += 15;
      }
    }
  }

  if (matchedTokens === 0) return 0;
  if (allInTitle && tokens.length > 1) {
    score += 100;
  }

  return score;
}

export async function searchAndRankWorkspaceItems(
  actor: any,
  queryOrId: string,
  kindFilter?: string
): Promise<{
  exact?: WorkspaceItemMatch;
  topMatches: WorkspaceItemMatch[];
}> {
  const domainUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
  const q = queryOrId.trim();
  if (!q) return { topMatches: [] };

  const isQueryWithSpaces = /\s/.test(q);

  // 1. Direct ID check (only if single token / no spaces)
  if (!isQueryWithSpaces) {
    if (!kindFilter || kindFilter === 'idea' || kindFilter === 'note') {
      try {
        const note = await ApiResources.getNote(actor, q);
        if (note && note.id) {
          return {
            exact: {
              id: note.id,
              title: note.title || 'Untitled Idea',
              kind: 'idea',
              kindTitle: 'Idea',
              kindKey: 'idea',
              emoji: { name: '💡' },
              emojiChar: '💡',
              shareUrl: `${domainUrl}/idea/${encodeURIComponent(note.id)}`,
              preview: note.content ? String(note.content).slice(0, 100) : undefined,
              score: 1000,
            },
            topMatches: [],
          };
        }
      } catch {}
    }

    if (!kindFilter || kindFilter === 'goal') {
      try {
        const goal = await ApiResources.getGoal(actor, q);
        if (goal && goal.id) {
          return {
            exact: {
              id: goal.id,
              title: goal.title || 'Goal',
              kind: 'goal',
              kindTitle: 'Goal',
              kindKey: 'goal',
              emoji: { name: '🎯' },
              emojiChar: '🎯',
              shareUrl: `${domainUrl}/goal/${encodeURIComponent(goal.id)}`,
              preview: goal.description ? String(goal.description).slice(0, 100) : undefined,
              score: 1000,
            },
            topMatches: [],
          };
        }
      } catch {}
    }

    if (kindFilter === 'vault' || kindFilter === 'secret') {
      return {
        exact: {
          id: q,
          title: 'Vault Secret',
          kind: 'vault',
          kindTitle: 'Vault Secret',
          kindKey: 'vault',
          emoji: { name: '🔐' },
          emojiChar: '🔐',
          shareUrl: `${domainUrl}/vault/${encodeURIComponent(q)}`,
          score: 1000,
        },
        topMatches: [],
      };
    }
  }

  // 2. Fetch candidates from ideas, goals, workspaces
  const fetchIdeas = !kindFilter || kindFilter === 'idea' || kindFilter === 'note';
  const fetchGoals = !kindFilter || kindFilter === 'goal';
  const fetchWs = kindFilter === 'workspace';

  const [notesRes, goalsRes, wsRes] = await Promise.all([
    fetchIdeas ? ApiResources.listNotes(actor, 40).catch(() => []) : Promise.resolve([]),
    fetchGoals ? ApiResources.listGoals(actor, 40).catch(() => []) : Promise.resolve([]),
    fetchWs ? ApiResources.listWorkspaces(actor, 20).catch(() => []) : Promise.resolve([]),
  ]);

  const candidates: WorkspaceItemMatch[] = [];

  for (const n of extractItems(notesRes)) {
    const score = computeFuzzyMatchScore(n.title, n.content, q, n.id);
    if (score > 0) {
      candidates.push({
        id: n.id,
        title: n.title || 'Untitled Idea',
        kind: 'idea',
        kindTitle: 'Idea',
        kindKey: 'idea',
        emoji: { name: '💡' },
        emojiChar: '💡',
        shareUrl: `${domainUrl}/idea/${encodeURIComponent(n.id)}`,
        preview: n.content ? String(n.content).slice(0, 100) : undefined,
        score,
      });
    }
  }

  for (const g of extractItems(goalsRes)) {
    const score = computeFuzzyMatchScore(g.title, g.description, q, g.id);
    if (score > 0) {
      candidates.push({
        id: g.id,
        title: g.title || 'Goal',
        kind: 'goal',
        kindTitle: 'Goal',
        kindKey: 'goal',
        emoji: { name: g.status === 'completed' ? '✅' : '🎯' },
        emojiChar: g.status === 'completed' ? '✅' : '🎯',
        shareUrl: `${domainUrl}/goal/${encodeURIComponent(g.id)}`,
        preview: g.description ? String(g.description).slice(0, 100) : undefined,
        score,
      });
    }
  }

  for (const w of extractItems(wsRes)) {
    const score = computeFuzzyMatchScore(w.name || w.title, '', q, w.id);
    if (score > 0) {
      candidates.push({
        id: w.id,
        title: w.name || w.title || 'Workspace',
        kind: 'workspace',
        kindTitle: 'Workspace',
        kindKey: 'workspace',
        emoji: { name: '📂' },
        emojiChar: '📂',
        shareUrl: `${domainUrl}/workspace/${encodeURIComponent(w.id)}`,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 1) {
    return { exact: candidates[0], topMatches: candidates };
  }
  if (candidates.length > 0 && candidates[0].score >= 600 && candidates[0].score > (candidates[1]?.score || 0) + 150) {
    return { exact: candidates[0], topMatches: candidates.slice(0, 3) };
  }

  return {
    topMatches: candidates.slice(0, 3),
  };
}

export async function resolveMessageForSave(
  payload: any,
  inputArg?: string
): Promise<{ content: string; authorName?: string; sourceDesc: string } | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = payload?.channel_id;

  // 1. Message link: https://discord.com/channels/<guildId>/<channelId>/<messageId>
  if (inputArg && /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/.test(inputArg)) {
    const match = inputArg.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (match && match[2] && match[3] && botToken) {
      const linkChannelId = match[2];
      const linkMessageId = match[3];
      try {
        const res = await fetch(`https://discord.com/api/v10/channels/${linkChannelId}/messages/${linkMessageId}`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        if (res.ok) {
          const msg = await res.json();
          const text = msg.content || msg.attachments?.[0]?.url || '';
          if (text) {
            return {
              content: text,
              authorName: msg.author?.username || 'user',
              sourceDesc: `Linked message (<#${linkChannelId}>)`,
            };
          }
        }
      } catch {}
    }
  }

  // 2. Direct message ID (17-20 digits)
  if (inputArg && /^\d{17,20}$/.test(inputArg.trim()) && channelId && botToken) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${inputArg.trim()}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (res.ok) {
        const msg = await res.json();
        const text = msg.content || msg.attachments?.[0]?.url || '';
        if (text) {
          return {
            content: text,
            authorName: msg.author?.username || 'user',
            sourceDesc: `Message by @${msg.author?.username || 'user'}`,
          };
        }
      }
    } catch {}
  }

  // 3. User passed raw text that is not a link or ID (only if explicit input was provided)
  if (inputArg && inputArg.trim()) {
    return {
      content: inputArg.trim(),
      sourceDesc: 'Direct text input',
    };
  }

  // 4. Command was invoked with resolved messages (Message Context Menu or Interaction Resolved)
  if (payload?.data?.target_id && payload?.data?.resolved?.messages?.[payload.data.target_id]) {
    const msg = payload.data.resolved.messages[payload.data.target_id];
    const text = msg.content || msg.attachments?.[0]?.url || '';
    if (text) {
      return {
        content: text,
        authorName: msg.author?.username || 'user',
        sourceDesc: `Target message by @${msg.author?.username || 'user'}`,
      };
    }
  }
  if (payload?.data?.resolved?.messages) {
    const msgs = Object.values(payload.data.resolved.messages) as any[];
    if (msgs.length > 0) {
      const msg = msgs[0];
      const text = msg.content || msg.attachments?.[0]?.url || '';
      if (text) {
        return {
          content: text,
          authorName: msg.author?.username || 'user',
          sourceDesc: `Referenced message by @${msg.author?.username || 'user'}`,
        };
      }
    }
  }

  // 5. Command was invoked as a reply to a message in Discord
  if (payload?.message?.referenced_message) {
    const ref = payload.message.referenced_message;
    const text = ref.content || ref.attachments?.[0]?.url || '';
    if (text) {
      return {
        content: text,
        authorName: ref.author?.username || 'user',
        sourceDesc: `Replied message by @${ref.author?.username || 'user'}`,
      };
    }
  }

  // 6. Fetch recent messages in channel to capture tagged message or previous non-bot message
  if (channelId && botToken) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=10`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (res.ok) {
        const messages: any[] = await res.json();
        const botId = process.env.DISCORD_APPLICATION_ID || '1553752726070886412';

        // Find latest message not authored by a bot
        const nonBot = messages.find((m) => !m.author?.bot && m.author?.id !== botId);
        if (nonBot) {
          // If that message is a reply to another message, the replied-to message is what the user tagged!
          const target = nonBot.referenced_message || nonBot;
          const text = target.content || target.attachments?.[0]?.url || '';
          if (text) {
            return {
              content: text,
              authorName: target.author?.username || 'user',
              sourceDesc: nonBot.referenced_message
                ? `Replied message by @${target.author?.username || 'user'}`
                : `Previous message by @${target.author?.username || 'user'}`,
            };
          }
        }

        // Fallback: any message with text/attachments not authored by our bot
        const prev = messages.find(
          (m) => m.author?.id !== botId && (m.content || (m.attachments && m.attachments.length > 0))
        );
        if (prev) {
          const target = prev.referenced_message || prev;
          const text = target.content || target.attachments?.[0]?.url || '';
          if (text) {
            return {
              content: text,
              authorName: target.author?.username || 'user',
              sourceDesc: `Previous message by @${target.author?.username || 'user'}`,
            };
          }
        }
      }
    } catch {}
  }

  return null;
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
            label: 'Ideas Management',
            value: 'val_ideas',
            description: 'Inspect, view, and create sovereign ideas',
            emoji: { name: '💡' },
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
      { type: 2, style: 1, label: 'Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
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
          '• **💡 Ideas:** Sovereign ideas (`/ideas`, `/idea`, `/idea_read`, `/idea_delete`)\n' +
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

function buildIdeasEmbed(notes: any[], isLinked = true) {
  const fields =
    notes.length > 0
      ? notes.map((n, idx) => ({
          name: `${idx + 1}. ${n.title || 'Untitled'}`,
          value: `> ${n.content ? n.content.replace(/\n/g, ' ').slice(0, 70) : '*(Empty body)*'}\n\`ID: ${n.id}\``,
          inline: false,
        }))
      : [
          {
            name: 'No Ideas Found',
            value: isLinked
              ? 'Create your first idea using `/idea title: ... content: ...`'
              : 'Create an idea with `/idea` or connect your Kylrix account using `/pair` to view your ideas.',
            inline: false,
          },
        ];

  const components: any[] = [buildDiscordSelectMenu()];

  // Interactive buttons for first 2 ideas
  if (notes.length > 0) {
    const actionRowComponents: any[] = [];
    notes.slice(0, 2).forEach((n, idx) => {
      actionRowComponents.push({
        type: 2,
        style: 2,
        label: `Read #${idx + 1}`,
        custom_id: `read_idea:${n.id}`,
        emoji: { name: '📖' },
      });
      actionRowComponents.push({
        type: 2,
        style: 4,
        label: `Delete #${idx + 1}`,
        custom_id: `del_idea:${n.id}`,
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
      { type: 2, style: 1, label: 'Refresh Ideas', custom_id: 'btn_ideas', emoji: { name: '🔄' } },
      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
      { type: 2, style: 5, label: 'Open in App', url: 'https://www.kylrix.space/idea' },
    ],
  });

  return {
    embeds: [
      {
        title: '💡 Kylrix Sovereign Ideas',
        description: isLinked
          ? 'Your recent sovereign ideas synced across web, desktop, and mobile:'
          : '⚠️ *Operating in Sandbox Mode.* Use `/pair` or `/link` to connect your Kylrix account.\n\nYour ideas:',
        color: 0xec4899, // Pink #EC4899
        fields,
        footer: { text: isLinked ? 'Kylrix Ideas • Sovereign & Synced' : 'Kylrix Ideas • Sandbox Mode' },
      },
    ],
    components,
  };
}
const buildNotesEmbed = buildIdeasEmbed;

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
        description: 'Workspaces isolate your project tasks, ideas, and agentic workflows:',
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

    // B. Ideas Menu
    if (customId === 'btn_notes' || customId === 'btn_ideas' || selectedValue === 'val_notes' || selectedValue === 'val_ideas') {
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

    // H. Read Idea Callback
    if (customId.startsWith('read_idea:') || customId.startsWith('read_note:')) {
      const noteId = customId.replace(/^(read_idea:|read_note:)/, '');
      try {
        const note = await ApiResources.getNote(actor, noteId);
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: `💡 ${note.title || 'Untitled Idea'}`,
                description: note.content ? `${note.content}` : '*(Empty body)*',
                color: 0xec4899,
                fields: [
                  { name: 'Idea ID', value: `\`${note.id}\``, inline: true },
                  { name: 'Status', value: '🟢 Decrypted', inline: true },
                ],
                footer: { text: 'Kylrix Sovereign Ideas' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 4, label: 'Delete Idea', custom_id: `del_idea:${note.id}`, emoji: { name: '🗑️' } },
                  { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Could not read idea: ${err?.message || 'Idea not found'}` },
        });
      }
    }

    // I. Delete Idea Callback
    if (customId.startsWith('del_idea:') || customId.startsWith('del_note:')) {
      const noteId = customId.replace(/^(del_idea:|del_note:)/, '');
      try {
        await ApiResources.deleteNote(actor, noteId);
        return NextResponse.json({
          type: 7,
          data: {
            embeds: [
              {
                title: '🗑️ Idea Deleted',
                description: `Idea with ID \`${noteId}\` was removed.`,
                color: 0xef4444,
                footer: { text: 'Kylrix Sovereign Ideas' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 1, label: 'Back to Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 7,
          data: { content: `❌ Idea deletion failed: ${err?.message || 'Error'}` },
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

    // L. Search Select Menu Pick Callback
    if (customId === 'kylrix_search_select' || selectedValue.startsWith('search_pick_')) {
      const val = selectedValue || '';
      if (val.startsWith('search_pick_idea:') || val.startsWith('search_pick_note:')) {
        const noteId = val.replace(/^(search_pick_idea:|search_pick_note:)/, '');
        try {
          const note = await ApiResources.getNote(actor, noteId);
          return NextResponse.json({
            type: 7,
            data: {
              embeds: [
                {
                  title: `💡 ${note.title || 'Untitled Idea'}`,
                  description: note.content ? `${note.content}` : '*(Empty body)*',
                  color: 0xec4899,
                  fields: [
                    { name: 'Idea ID', value: `\`${note.id}\``, inline: true },
                    { name: 'Status', value: '🟢 Decrypted', inline: true },
                  ],
                  footer: { text: 'Kylrix Sovereign Ideas' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 5, label: 'Open in Web', url: `https://www.kylrix.space/idea/${note.id}` },
                    { type: 2, style: 4, label: 'Delete Idea', custom_id: `del_idea:${note.id}`, emoji: { name: '🗑️' } },
                    { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 7,
            data: { content: `❌ Idea not found or inaccessible: ${err?.message || 'Error'}` },
          });
        }
      }

      if (val.startsWith('search_pick_goal:')) {
        const goalId = val.replace('search_pick_goal:', '');
        try {
          const goal = await ApiResources.getGoal(actor, goalId);
          const isDone = goal.status === 'completed';
          return NextResponse.json({
            type: 7,
            data: {
              embeds: [
                {
                  title: `${isDone ? '✅' : '🎯'} ${goal.title || 'Goal'}`,
                  description: goal.description ? `${goal.description}` : '*(No description)*',
                  color: isDone ? 0x10b981 : 0xa855f7,
                  fields: [
                    { name: 'Status', value: `**${goal.status || 'todo'}**`, inline: true },
                    { name: 'Goal ID', value: `\`${goal.id}\``, inline: true },
                  ],
                  footer: { text: 'Kylrix Deliverables & Goals' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    !isDone
                      ? { type: 2, style: 3, label: 'Mark Done', custom_id: `done_goal:${goal.id}`, emoji: { name: '✅' } }
                      : { type: 2, style: 1, label: 'All Goals', custom_id: 'btn_goals', emoji: { name: '🎯' } },
                    { type: 2, style: 5, label: 'Open in Web', url: `https://www.kylrix.space/goal/${goal.id}` },
                    { type: 2, style: 4, label: 'Delete Goal', custom_id: `del_goal:${goal.id}`, emoji: { name: '🗑️' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 7,
            data: { content: `❌ Goal not found or inaccessible: ${err?.message || 'Error'}` },
          });
        }
      }
    }

    // M. Check Pairing Status Callback
    if (customId.startsWith('check_pair:')) {
      const deviceCode = customId.replace('check_pair:', '');
      try {
        const exchange = await PairingService.exchangeDeviceCode(deviceCode);
        if ((exchange.status === 'approved' || exchange.status === 'granted') && exchange.userId) {
          await linkDiscordUserAccount(callerId, exchange.userId, callerName);
          return NextResponse.json({
            type: 7,
            data: {
              embeds: [
                {
                  title: '🎉 Account Successfully Paired!',
                  description:
                    `Your Discord account is now securely linked to Kylrix account **\`${exchange.userId}\`**.\n\n` +
                    `All your sovereign ideas, deliverables, and workspaces are now accessible right here in Discord!`,
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
                    { type: 2, style: 1, label: 'View Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
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

    // N. Share Pick Callback
    if (customId.startsWith('share_pick:')) {
      const parts = customId.split(':');
      const pickKind = parts[1] || 'idea';
      const pickId = parts[2] || '';
      const domainUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
      let sharePath = `/idea/${encodeURIComponent(pickId)}`;
      let kindTitle = 'Idea';

      if (pickKind === 'goal') {
        sharePath = `/goal/${encodeURIComponent(pickId)}`;
        kindTitle = 'Goal';
      } else if (pickKind === 'workspace') {
        sharePath = `/workspace/${encodeURIComponent(pickId)}`;
        kindTitle = 'Workspace';
      } else if (pickKind === 'vault') {
        sharePath = `/vault/${encodeURIComponent(pickId)}`;
        kindTitle = 'Vault Secret';
      }

      const shareUrl = `${domainUrl}${sharePath}`;
      return NextResponse.json({
        type: 7, // UPDATE_MESSAGE
        data: {
          embeds: [
            {
              title: `🔗 Share Link: ${kindTitle}`,
              description:
                `Here is the secure direct web link for your **${kindTitle}**:\n\n` +
                `👉 **[${shareUrl}](${shareUrl})**\n\n` +
                `*(Only users with permission or invite access will be able to unlock this resource in accordance with zero-knowledge policies).*`,
              color: 0x06b6d4, // Cyan
              fields: [
                { name: 'Resource Type', value: kindTitle, inline: true },
                { name: 'Resource ID', value: `\`${pickId}\``, inline: true },
                { name: 'Privacy Mode', value: '🔒 Zero-Knowledge Gated', inline: true },
              ],
              footer: { text: 'Kylrix Resource Sharing • www.kylrix.space' },
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 5, label: 'Open Link', url: shareUrl },
                { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
              ],
            },
          ],
        },
      });
    }

    // Fallback acknowledge
    return NextResponse.json({ type: 7, data: buildMainDashboardEmbed(callerName, isLinked) });
  }

  // ── 4. TYPE 2: APPLICATION_COMMAND (Slash Commands & Message Context Actions) ──
  if (payload.type === 2) {
    const commandName = payload.data?.name || '';
    const commandType = payload.data?.type || 1; // 1 = CHAT_INPUT, 3 = MESSAGE
    const options: any[] = payload.data?.options || [];
    const getOption = (name: string) => options.find((o) => o.name === name)?.value;

    // A. Handle Discord Message Context Menu Actions ("Save as Idea" or "Save & Share")
    if (
      commandType === 3 ||
      commandName === 'Save as Idea' ||
      commandName === 'save_as_idea' ||
      commandName === 'Save & Share' ||
      commandName === 'save_and_share'
    ) {
      const isShareMode = commandName === 'Save & Share' || commandName === 'save_and_share';
      const targetId = payload.data?.target_id;
      const targetMsg = payload.data?.resolved?.messages?.[targetId];
      const rawContent = targetMsg?.content || targetMsg?.attachments?.[0]?.url || '';
      if (!rawContent) {
        return NextResponse.json({
          type: 4,
          data: { content: '❌ Target message contains no text or attachments to save.' },
        });
      }
      const title = extractTitleSnippet(rawContent);
      try {
        const newNote = await ApiResources.createNote(actor, { title, content: rawContent });
        const domainUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';
        const shareUrl = `${domainUrl}/idea/${encodeURIComponent(newNote.id)}`;

        return NextResponse.json({
          type: 4,
          data: {
            embeds: [
              {
                title: isShareMode ? `🔗 Idea Saved & Shared: ${newNote.title}` : `💡 Idea Saved from Message: ${newNote.title}`,
                description: isShareMode
                  ? `Here is your secure share link for this saved idea:\n\n👉 **[${shareUrl}](${shareUrl})**\n\n` +
                    (rawContent.length > 400 ? `> ${rawContent.slice(0, 400)}...` : `> ${rawContent}`)
                  : rawContent.length > 500 ? `${rawContent.slice(0, 500)}...` : `> ${rawContent}`,
                color: isShareMode ? 0x06b6d4 : 0x10b981,
                fields: [
                  { name: 'Saved By', value: callerName, inline: true },
                  { name: 'Idea ID', value: `\`${newNote.id}\``, inline: true },
                  ...(isShareMode ? [{ name: 'Share Link', value: `[Open Link](${shareUrl})`, inline: true }] : []),
                ],
                footer: { text: isLinked ? 'Kylrix Ideas • Sovereign & Synced' : 'Kylrix Ideas • Sandbox Mode' },
              },
            ],
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 5, label: 'Open in Web', url: shareUrl },
                  { type: 2, style: 2, label: 'Read Idea', custom_id: `read_idea:${newNote.id}`, emoji: { name: '📖' } },
                  { type: 2, style: 1, label: 'Share Link', custom_id: `share_pick:idea:${newNote.id}`, emoji: { name: '🔗' } },
                  { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                ],
              },
            ],
          },
        });
      } catch (err: any) {
        return NextResponse.json({
          type: 4,
          data: { content: `❌ Could not save message as idea: ${err?.message || 'Error'}` },
        });
      }
    }

    switch (commandName) {
      case 'menu': {
        const data = buildMainDashboardEmbed(callerName, isLinked);
        return NextResponse.json({ type: 4, data }); // Type 4: CHANNEL_MESSAGE_WITH_SOURCE
      }

      case 'notes':
      case 'ideas': {
        const notesRes = await ApiResources.listNotes(actor, 5).catch(() => []);
        const data = buildIdeasEmbed(extractItems(notesRes), isLinked);
        return NextResponse.json({ type: 4, data });
      }

      case 'note':
      case 'idea': {
        const title = getOption('title') || 'Quick Idea';
        const content = getOption('content') || '';
        try {
          const newNote = await ApiResources.createNote(actor, { title, content });
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `💡 Idea Captured: ${newNote.title}`,
                  description: content ? `> ${content}` : '*(Empty body)*',
                  color: 0xec4899,
                  fields: [
                    { name: 'Author', value: callerName, inline: true },
                    { name: 'Idea ID', value: `\`${newNote.id}\``, inline: true },
                  ],
                  footer: { text: isLinked ? 'Kylrix Ideas • Sovereign & Synced' : 'Kylrix Ideas • Sandbox Mode' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 2, label: 'Read Idea', custom_id: `read_idea:${newNote.id}`, emoji: { name: '📖' } },
                    { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Idea creation failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'save': {
        const inputArg = String(getOption('message') || getOption('content') || getOption('text') || '').trim();
        const customTitle = String(getOption('title') || '').trim();

        const resolved = await resolveMessageForSave(payload, inputArg);
        if (!resolved || !resolved.content) {
          return NextResponse.json({
            type: 4,
            data: {
              content:
                '❌ Could not find a message to save as an idea.\n\n**How to use `/save`:**\n• Run `/save` directly after a message in the channel\n• Reply to a message and invoke `/save`\n• Pass text or a message link: `/save message: <text or link>`\n• Right-click any message → **Apps** → **Save as Idea**',
            },
          });
        }

        const rawContent = resolved.content;
        const title = customTitle || extractTitleSnippet(rawContent);
        try {
          const newNote = await ApiResources.createNote(actor, { title, content: rawContent });
          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `💡 Idea Saved: ${newNote.title}`,
                  description: rawContent.length > 500 ? `${rawContent.slice(0, 500)}...` : `> ${rawContent}`,
                  color: 0x10b981,
                  fields: [
                    { name: 'Author', value: resolved.authorName ? `@${resolved.authorName}` : callerName, inline: true },
                    { name: 'Idea ID', value: `\`${newNote.id}\``, inline: true },
                    { name: 'Source', value: resolved.sourceDesc, inline: true },
                  ],
                  footer: { text: isLinked ? 'Kylrix Ideas • Sovereign & Synced' : 'Kylrix Ideas • Sandbox Mode' },
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 2, label: 'Read Idea', custom_id: `read_idea:${newNote.id}`, emoji: { name: '📖' } },
                    { type: 2, style: 5, label: 'Open in Web', url: `https://www.kylrix.space/idea/${newNote.id}` },
                    { type: 2, style: 1, label: 'Share Link', custom_id: `share_pick:idea:${newNote.id}`, emoji: { name: '🔗' } },
                    { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                  ],
                },
              ],
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Idea save failed: ${err?.message || 'Error'}` },
          });
        }
      }

      case 'note_read':
      case 'idea_read': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Idea ID or title snippet is required: `/idea_read id: <id or title>`' },
          });
        }
        try {
          const resolved = await searchAndRankWorkspaceItems(actor, id, 'idea');
          if (resolved.exact) {
            const note = await ApiResources.getNote(actor, resolved.exact.id);
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `💡 ${note.title || 'Untitled Idea'}`,
                    description: note.content ? `${note.content}` : '*(Empty body)*',
                    color: 0xec4899,
                    fields: [
                      { name: 'Idea ID', value: `\`${note.id}\``, inline: true },
                      { name: 'Status', value: '🟢 Decrypted', inline: true },
                    ],
                    footer: { text: 'Kylrix Sovereign Ideas' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 4, label: 'Delete Idea', custom_id: `del_idea:${note.id}`, emoji: { name: '🗑️' } },
                      { type: 2, style: 1, label: 'Share Link', custom_id: `share_pick:idea:${note.id}`, emoji: { name: '🔗' } },
                      { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          if (resolved.topMatches.length > 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 Close Matches for "${id}"`,
                    description: `Multiple ideas matched your query. Select which idea to open:`,
                    color: 0xec4899,
                    fields: resolved.topMatches.map((m, idx) => ({
                      name: `${idx + 1}. 💡 ${m.title}`,
                      value: `ID: \`${m.id}\`${m.preview ? `\n> ${m.preview}` : ''}`,
                      inline: false,
                    })),
                    footer: { text: 'Kylrix Ideas • Tap a button below to read' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: resolved.topMatches.map((m) => ({
                      type: 2,
                      style: 1,
                      label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
                      custom_id: `read_idea:${m.id}`,
                      emoji: { name: '📖' },
                    })),
                  },
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          return NextResponse.json({
            type: 4,
            data: { content: `❌ No ideas found matching "${id}". Use \`/ideas\` to see recent ideas.` },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Could not read idea: ${err?.message || 'Idea not found'}` },
          });
        }
      }

      case 'note_delete':
      case 'idea_delete': {
        const id = String(getOption('id') || '').trim();
        if (!id) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Idea ID or title snippet is required: `/idea_delete id: <id or title>`' },
          });
        }
        try {
          const resolved = await searchAndRankWorkspaceItems(actor, id, 'idea');
          if (resolved.exact) {
            await ApiResources.deleteNote(actor, resolved.exact.id);
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: '🗑️ Idea Deleted',
                    description: `**${resolved.exact.title}** (\`${resolved.exact.id}\`) was permanently removed.`,
                    color: 0xef4444,
                    footer: { text: 'Kylrix Sovereign Ideas' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, label: 'Back to Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          if (resolved.topMatches.length > 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 Close Matches to Delete for "${id}"`,
                    description: `Multiple ideas matched your query. Select which idea to permanently remove:`,
                    color: 0xef4444,
                    fields: resolved.topMatches.map((m, idx) => ({
                      name: `${idx + 1}. 💡 ${m.title}`,
                      value: `ID: \`${m.id}\`${m.preview ? `\n> ${m.preview}` : ''}`,
                      inline: false,
                    })),
                    footer: { text: 'Kylrix Ideas • Tap a button below to delete' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: resolved.topMatches.map((m) => ({
                      type: 2,
                      style: 4,
                      label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
                      custom_id: `del_idea:${m.id}`,
                      emoji: { name: '🗑️' },
                    })),
                  },
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, label: 'Back to Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          return NextResponse.json({
            type: 4,
            data: { content: `❌ No ideas found matching "${id}" to delete.` },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Idea deletion failed: ${err?.message || 'Error'}` },
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
            data: { content: '❌ Goal ID or title snippet is required: `/goal_done id: <id or title>`' },
          });
        }
        try {
          const resolved = await searchAndRankWorkspaceItems(actor, id, 'goal');
          if (resolved.exact) {
            const updated = await ApiResources.updateGoal(actor, resolved.exact.id, { status: 'completed' });
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
          }

          if (resolved.topMatches.length > 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 Close Matches for "${id}"`,
                    description: `Multiple goals matched your query. Select which goal to mark completed:`,
                    color: 0x10b981,
                    fields: resolved.topMatches.map((m, idx) => ({
                      name: `${idx + 1}. 🎯 ${m.title}`,
                      value: `ID: \`${m.id}\`${m.preview ? `\n> ${m.preview}` : ''}`,
                      inline: false,
                    })),
                    footer: { text: 'Kylrix Goals • Tap a button below to complete' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: resolved.topMatches.map((m) => ({
                      type: 2,
                      style: 3,
                      label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
                      custom_id: `done_goal:${m.id}`,
                      emoji: { name: '✅' },
                    })),
                  },
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
          }

          return NextResponse.json({
            type: 4,
            data: { content: `❌ No goals found matching "${id}". Use \`/goals\` to see active deliverables.` },
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
            data: { content: '❌ Goal ID or title snippet is required: `/goal_delete id: <id or title>`' },
          });
        }
        try {
          const resolved = await searchAndRankWorkspaceItems(actor, id, 'goal');
          if (resolved.exact) {
            await ApiResources.deleteGoal(actor, resolved.exact.id);
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: '🗑️ Goal Deleted',
                    description: `**${resolved.exact.title}** (\`${resolved.exact.id}\`) was permanently removed.`,
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
          }

          if (resolved.topMatches.length > 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 Close Matches to Delete for "${id}"`,
                    description: `Multiple goals matched your query. Select which goal to delete:`,
                    color: 0xef4444,
                    fields: resolved.topMatches.map((m, idx) => ({
                      name: `${idx + 1}. 🎯 ${m.title}`,
                      value: `ID: \`${m.id}\`${m.preview ? `\n> ${m.preview}` : ''}`,
                      inline: false,
                    })),
                    footer: { text: 'Kylrix Goals • Tap a button below to delete' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: resolved.topMatches.map((m) => ({
                      type: 2,
                      style: 4,
                      label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
                      custom_id: `del_goal:${m.id}`,
                      emoji: { name: '🗑️' },
                    })),
                  },
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
          }

          return NextResponse.json({
            type: 4,
            data: { content: `❌ No goals found matching "${id}" to delete.` },
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
                    `You can now view, create, and manage your real sovereign ideas, goals, and workspaces directly from Discord!`,
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
                    { type: 2, style: 1, label: 'View Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
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

      case 'search': {
        const query = String(getOption('query') || '').trim();
        if (!query) {
          return NextResponse.json({
            type: 4,
            data: { content: '❌ Search keyword is required: `/search query: <keyword>`' },
          });
        }
        try {
          const qLower = query.toLowerCase();
          const [notesRes, goalsRes] = await Promise.all([
            ApiResources.listNotes(actor, 15).catch(() => []),
            ApiResources.listGoals(actor, 15).catch(() => []),
          ]);

          const notes = extractItems(notesRes);
          const goals = extractItems(goalsRes);

          const matchedNotes = notes.filter(
            (n: any) =>
              (n.title && n.title.toLowerCase().includes(qLower)) ||
              (n.content && n.content.toLowerCase().includes(qLower))
          );
          const matchedGoals = goals.filter(
            (g: any) =>
              (g.title && g.title.toLowerCase().includes(qLower)) ||
              (g.description && g.description.toLowerCase().includes(qLower))
          );

          const totalMatches = matchedNotes.length + matchedGoals.length;

          if (totalMatches === 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 No Results for "${query}"`,
                    description: `No ideas or deliverables matched your search keyword in ${isLinked ? 'your linked workspace' : 'the sandbox workspace'}.`,
                    color: 0x6b7280,
                    footer: { text: 'Kylrix Workspace Search' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                      { type: 2, style: 5, label: 'Search in Web App', url: `https://www.kylrix.space/idea?search=${encodeURIComponent(query)}` },
                    ],
                  },
                ],
              },
            });
          }

          const fields: any[] = [];
          const selectOptions: any[] = [];

          if (matchedNotes.length > 0) {
            fields.push({
              name: `💡 Ideas (${matchedNotes.length})`,
              value: matchedNotes
                .slice(0, 4)
                .map((n: any) => `• **${n.title || 'Untitled'}** (\`${n.id}\`)`)
                .join('\n'),
              inline: false,
            });
            matchedNotes.slice(0, 10).forEach((n: any) => {
              selectOptions.push({
                label: `Idea: ${((n.title || 'Untitled Idea') as string).slice(0, 80)}`,
                value: `search_pick_idea:${n.id}`,
                description: `ID: ${n.id}`.slice(0, 100),
                emoji: { name: '💡' },
              });
            });
          }

          if (matchedGoals.length > 0) {
            fields.push({
              name: `🎯 Deliverables / Goals (${matchedGoals.length})`,
              value: matchedGoals
                .slice(0, 4)
                .map((g: any) => `• [${g.status === 'completed' ? '✅' : '⏳'}] **${g.title || 'Goal'}** (\`${g.id}\`)`)
                .join('\n'),
              inline: false,
            });
            matchedGoals.slice(0, 10).forEach((g: any) => {
              selectOptions.push({
                label: `Goal: ${((g.title || 'Untitled Goal') as string).slice(0, 80)}`,
                value: `search_pick_goal:${g.id}`,
                description: `Status: ${g.status || 'todo'} • ID: ${g.id}`.slice(0, 100),
                emoji: { name: g.status === 'completed' ? '✅' : '🎯' },
              });
            });
          }

          const components: any[] = [];

          if (selectOptions.length > 0) {
            components.push({
              type: 1,
              components: [
                {
                  type: 3,
                  custom_id: 'kylrix_search_select',
                  placeholder: '⚡ Select an item to inspect or take action...',
                  options: selectOptions.slice(0, 25),
                },
              ],
            });
          }

          components.push({
            type: 1,
            components: [
              { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
              { type: 2, style: 5, label: 'Open in Kylrix', url: 'https://www.kylrix.space/app' },
            ],
          });

          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `🔍 Search Results: "${query}"`,
                  description: `Found **${totalMatches}** matching items across your workspace. Use the dropdown below to inspect or manage any item:`,
                  color: 0x3b82f6, // Blue
                  fields,
                  footer: { text: isLinked ? 'Kylrix Unified Search • Select an item below' : 'Kylrix Search • Sandbox Mode' },
                },
              ],
              components,
            },
          });
        } catch (err: any) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Search error: ${err?.message || 'Failed to search'}` },
          });
        }
      }

      case 'share': {
        const kind = String(getOption('kind') || '').trim().toLowerCase();
        const rawTarget = String(getOption('item') || getOption('id') || getOption('query') || '').trim();
        const domainUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kylrix.space';

        // A. If no item argument was provided, resolve tagged or previous channel message, save it as an idea, and print out share URI!
        if (!rawTarget) {
          const resolved = await resolveMessageForSave(payload);
          if (resolved && resolved.content) {
            const rawContent = resolved.content;
            const title = extractTitleSnippet(rawContent);
            try {
              const newNote = await ApiResources.createNote(actor, { title, content: rawContent });
              const shareUrl = `${domainUrl}/idea/${encodeURIComponent(newNote.id)}`;
              return NextResponse.json({
                type: 4,
                data: {
                  embeds: [
                    {
                      title: `🔗 Idea Saved & Shared: ${newNote.title}`,
                      description:
                        `Here is your secure share link for this saved idea:\n\n` +
                        `👉 **[${shareUrl}](${shareUrl})**\n\n` +
                        (rawContent.length > 300 ? `> ${rawContent.slice(0, 300)}...` : `> ${rawContent}`),
                      color: 0x06b6d4, // Cyan
                      fields: [
                        { name: 'Author', value: resolved.authorName ? `@${resolved.authorName}` : callerName, inline: true },
                        { name: 'Idea ID', value: `\`${newNote.id}\``, inline: true },
                        { name: 'Source', value: resolved.sourceDesc, inline: true },
                      ],
                      footer: { text: isLinked ? 'Kylrix Ideas • Sovereign & Synced' : 'Kylrix Ideas • Sandbox Mode' },
                    },
                  ],
                  components: [
                    {
                      type: 1,
                      components: [
                        { type: 2, style: 5, label: 'Open Link', url: shareUrl },
                        { type: 2, style: 2, label: 'Read Idea', custom_id: `read_idea:${newNote.id}`, emoji: { name: '📖' } },
                        { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                      ],
                    },
                  ],
                },
              });
            } catch (err: any) {
              return NextResponse.json({
                type: 4,
                data: { content: `❌ Failed to save & share idea: ${err?.message || 'Error'}` },
              });
            }
          }

          return NextResponse.json({
            type: 4,
            data: {
              content:
                '❌ Could not find a message to save & share.\n\n' +
                '**How to use `/share`:**\n' +
                '• Tag / reply to a message and run `/share` to save it and get a share link\n' +
                '• Run `/share` directly after a message in the channel\n' +
                '• Share existing item: `/share item: <title or ID>`\n' +
                '• Right-click any message → **Apps** → **Save & Share**',
            },
          });
        }

        try {
          const resolved = await searchAndRankWorkspaceItems(actor, rawTarget, kind);

          if (resolved.exact) {
            const { id, title, kindTitle, shareUrl } = resolved.exact;
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔗 Share Link: ${title}`,
                    description:
                      `Here is the secure direct web link for **${title}**:\n\n` +
                      `👉 **[${shareUrl}](${shareUrl})**\n\n` +
                      `*(Only users with permission or invite access will be able to unlock this resource in accordance with zero-knowledge policies).*`,
                    color: 0x06b6d4, // Cyan
                    fields: [
                      { name: 'Resource Type', value: kindTitle, inline: true },
                      { name: 'Resource ID', value: `\`${id}\``, inline: true },
                      { name: 'Privacy Mode', value: '🔒 Zero-Knowledge Gated', inline: true },
                    ],
                    footer: { text: 'Kylrix Resource Sharing • www.kylrix.space' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 5, label: 'Open Link', url: shareUrl },
                      { type: 2, style: 1, label: 'All Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          if (resolved.topMatches.length > 0) {
            return NextResponse.json({
              type: 4,
              data: {
                embeds: [
                  {
                    title: `🔍 Close Matches for "${rawTarget}"`,
                    description: `Found multiple matching items in your workspace. Select which one to share:`,
                    color: 0x3b82f6,
                    fields: resolved.topMatches.map((m, idx) => ({
                      name: `${m.emojiChar} ${idx + 1}. ${m.title}`,
                      value: `Type: **${m.kindTitle}** • ID: \`${m.id}\`${m.preview ? `\n> ${m.preview}` : ''}`,
                      inline: false,
                    })),
                    footer: { text: 'Kylrix Smart Finding • Tap a button below to generate share link' },
                  },
                ],
                components: [
                  {
                    type: 1,
                    components: resolved.topMatches.map((m) => ({
                      type: 2,
                      style: 1,
                      label: m.title.length > 25 ? m.title.slice(0, 22) + '...' : m.title,
                      custom_id: `share_pick:${m.kindKey}:${m.id}`,
                      emoji: { name: m.emojiChar },
                    })),
                  },
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 2, label: 'Main Menu', custom_id: 'btn_main', emoji: { name: '🏠' } },
                    ],
                  },
                ],
              },
            });
          }

          return NextResponse.json({
            type: 4,
            data: {
              embeds: [
                {
                  title: `🔍 No Matches for "${rawTarget}"`,
                  description:
                    `Could not find any items matching "${rawTarget}" in your workspace.\n\n` +
                    `• Try searching keywords with \`/search query: <keyword>\`\n` +
                    `• Or list recent ideas with \`/ideas\` or goals with \`/goals\``,
                  color: 0xef4444,
                },
              ],
              components: [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, label: 'View Ideas', custom_id: 'btn_ideas', emoji: { name: '💡' } },
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
            data: { content: `❌ Share lookup failed: ${err?.message || 'Error'}` },
          });
        }
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

  const applicationId = process.env.DISCORD_APPLICATION_ID || process.env.NEXT_PUBLIC_DISCORD_APPLICATION_ID || '';
  const installUrl = applicationId
    ? `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=277025778752&integration_type=0,1`
    : null;

  return NextResponse.json({
    ok: true,
    service: 'kylrix-discord-bot',
    status: 'online',
    applicationId: applicationId || undefined,
    installUrl: installUrl || undefined,
    commands: DISCORD_SLASH_COMMANDS.map((c) => `/${c.name}`),
  });
}
