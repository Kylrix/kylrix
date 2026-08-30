import type { Client } from 'node-appwrite';
import { APPWRITE_CONFIG } from './config';

function resolveAppwriteRouterHost(): string {
  const raw =
    process.env.APPWRITE_DOMAIN ||
    process.env.DOMAIN ||
    process.env.NEXT_PUBLIC_DOMAIN ||
    'localhost';

  return raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

function isInternalAppwriteEndpoint(endpoint: string): boolean {
  try {
    const host = new URL(endpoint).hostname;
    return host === 'appwrite' || host === 'appwrite.local';
  } catch {
    return false;
  }
}

/**
 * Appwrite router-protection rejects internal Docker hostnames unless the
 * request carries the public Appwrite domain as Host.
 */
export function configureInternalAppwriteClient(
  client: Client,
  endpoint = APPWRITE_CONFIG.SERVER_ENDPOINT
): Client {
  if (isInternalAppwriteEndpoint(endpoint)) {
    client.addHeader('host', resolveAppwriteRouterHost());
  }
  return client;
}

export function internalAppwriteFetchHeaders(
  endpoint = APPWRITE_CONFIG.SERVER_ENDPOINT
): Record<string, string> {
  if (!isInternalAppwriteEndpoint(endpoint)) {
    return {};
  }
  return { Host: resolveAppwriteRouterHost() };
}
