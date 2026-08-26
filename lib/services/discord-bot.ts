import { createSystemFunctions } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
};

export const DiscordBotService = {
  /**
   * Dispatches a notification payload to a Discord channel via the discord-bot Appwrite Function.
   * Invoked via Function ID (APPWRITE_CONFIG.FUNCTIONS.DISCORD_BOT) for zero-trust isolation.
   */
  async dispatchNotification(params: {
    webhookUrl?: string;
    content?: string;
    embed?: DiscordEmbed;
    embeds?: DiscordEmbed[];
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const functions = createSystemFunctions();
      const functionId = APPWRITE_CONFIG.FUNCTIONS.DISCORD_BOT || 'discord-bot';

      const execution = await functions.createExecution(
        functionId,
        JSON.stringify({
          action: 'notify',
          webhookUrl: params.webhookUrl,
          content: params.content,
          embed: params.embed,
          embeds: params.embeds,
        }),
        false // Synchronous execution
      );

      const resBody = execution.responseBody ? JSON.parse(execution.responseBody) : {};
      return { ok: execution.responseStatusCode < 400 && resBody.ok !== false, error: resBody.error };
    } catch (err: any) {
      console.error('[DiscordBotService.dispatchNotification]', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Broadcasts an autonomous agent status/activity update to a Discord channel.
   */
  async broadcastAgentUpdate(params: {
    webhookUrl?: string;
    agentName: string;
    workspaceTitle: string;
    message: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const functions = createSystemFunctions();
      const functionId = APPWRITE_CONFIG.FUNCTIONS.DISCORD_BOT || 'discord-bot';

      const execution = await functions.createExecution(
        functionId,
        JSON.stringify({
          action: 'broadcast_agent_update',
          webhookUrl: params.webhookUrl,
          agentName: params.agentName,
          workspaceTitle: params.workspaceTitle,
          message: params.message,
        }),
        false
      );

      const resBody = execution.responseBody ? JSON.parse(execution.responseBody) : {};
      return { ok: execution.responseStatusCode < 400 && resBody.ok !== false, error: resBody.error };
    } catch (err: any) {
      console.error('[DiscordBotService.broadcastAgentUpdate]', err);
      return { ok: false, error: err.message };
    }
  },
};
