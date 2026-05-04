import { getEcosystemUrl } from "@/constants/ecosystem";

/**
 * Ecosystem Bridge
 * Standardizes cross-app communication via URL "Intents" and shared schemas.
 */

export type EcosystemIntent = 
  | 'create_note'
  | 'create_task'
  | 'save_credential'
  | 'start_chat'
  | 'focus_timer_control'
  | 'vault_lock';

export interface IntentPayload {
  intent: EcosystemIntent;
  source: string;
  data: Record<string, any>;
  callbackUrl?: string;
  autoClose?: boolean;
}

export const EcosystemBridge = {
  /**
   * Constructs a URL for another ecosystem app with an intent payload.
   */
  generateIntentUrl: (subdomain: string, payload: IntentPayload) => {
    const baseUrl = getEcosystemUrl(subdomain);
    const params = new URLSearchParams();
    params.set('is_embedded', 'true');
    params.set('intent', payload.intent);
    params.set('source', payload.source);
    
    // Flatten data for URL
    Object.entries(payload.data).forEach(([key, value]) => {
      params.set(`d_${key}`, String(value));
    });

    if (payload.callbackUrl) params.set('callback', payload.callbackUrl);
    if (payload.autoClose) params.set('autoclose', 'true');

    return `${baseUrl}?${params.toString()}`;
  },

  /**
   * Parses the current URL for ecosystem intents.
   */
  parseIntent: (url: string): IntentPayload | null => {
    const searchParams = new URL(url).searchParams;
    const intent = searchParams.get('intent') as EcosystemIntent | null;
    if (!intent) return null;

    const source = searchParams.get('source') || 'unknown';
    const data: Record<string, any> = {};

    searchParams.forEach((value, key) => {
      if (key.startsWith('d_')) {
        data[key.substring(2)] = value;
      }
    });

    return {
      intent,
      source,
      data,
      callbackUrl: searchParams.get('callback') || undefined,
      autoClose: searchParams.get('autoclose') === 'true'
    };
  }
};
