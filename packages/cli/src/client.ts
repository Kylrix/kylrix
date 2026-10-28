import { KylrixClient } from '@/sdk/api/client';
import { toBearerCredential } from '@/lib/security/zero-knowledge';
import { resolveEnvironment } from './config';

export function hasAuth(cliOptions: { url?: string; token?: string; workspace?: string } = {}): boolean {
  const env = resolveEnvironment(cliOptions);
  return Boolean(env.token);
}

export function getClient(cliOptions: { url?: string; token?: string; workspace?: string } = {}): KylrixClient {
  const env = resolveEnvironment(cliOptions);
  return new KylrixClient({
    baseUrl: env.apiUrl,
    // Single choke point: an agent key's unlock part never goes on the wire.
    token: env.token ? toBearerCredential(env.token) : env.token,
    workspaceId: env.workspaceId,
  });
}

export function requireAuthClient(cliOptions: { url?: string; token?: string; workspace?: string } = {}): KylrixClient {
  const client = getClient(cliOptions);
  const env = resolveEnvironment(cliOptions);
  if (!env.token) {
    throw new Error(
      'Authentication required for this cloud operation. Run `kylrix login` or set KYLRIX_API_KEY.',
    );
  }
  return client;
}
