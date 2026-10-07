/**
 * Pairing Service — RFC 8628-inspired Device Authorization & Punch Grant Engine.
 * 
 * Supports:
 * - First-party CLI headless login (`kylrix auth login`)
 * - Self-hosted to Cloud pairing flow (zero-token-copying sync handshake)
 * - Future companion mobile apps scanning a short pairing code
 * 
 * Stored in `oauth_consent_requests` (reused as the canonical authorization request table)
 * and issues user-scoped punch tokens via `PatService` (`kyl_punch_...`).
 */

import { randomBytes } from 'crypto';
import { ID, Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { PatService } from '@/lib/services/pats';
import { normalizeScopes } from '@/lib/api/scopes';
import { 
  shapePairingSession, 
  type PairingSessionRecord, 
  type PairingExchangeResult,
  type PairingRequestInput 
} from '@/sdk/contracts/pairing';

const DB = APPWRITE_CONFIG.DATABASES.NOTE || 'passwordManagerDb';
const REQUESTS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.OAUTH_CONSENT_REQUESTS || 'oauth_consent_requests';

// Pairing code validity duration: 15 minutes (900 seconds)
const PAIRING_EXPIRY_SECONDS = 900;
// Polling interval required of clients: 5 seconds
const POLLING_INTERVAL_SECONDS = 5;

/**
 * Generate a high-entropy, human-friendly 8-character code formatted as XXXX-XXXX (e.g. 7K9M-4W2P).
 * Uses Crockford-style Base32 characters (omitting ambiguous 0, O, 1, I, L) for error-free input.
 * 31^8 = ~852.8 billion combinations (~39.6 bits of cryptographic entropy).
 */
function generateHumanUserCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = randomBytes(8);
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars[bytes[i] % chars.length];
    p2 += chars[bytes[i + 4] % chars.length];
  }
  return `${p1}-${p2}`;
}

/**
 * Normalizes user code input for robust lookups:
 * Trims whitespace, uppercases, and handles both XXXX-XXXX and XXXXXXXX.
 */
export function normalizeUserCode(input: string): string {
  let clean = input.trim().toUpperCase().replace(/\s+/g, '');
  if (/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean;
}

interface MemoryPairingRecord {
  id: string;
  clientId: string;
  redirectUri: string;
  requestedScopes: string[];
  deviceCode: string;
  userCode: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestMeta: string;
  createdAt: string;
  expiresAt: string;
  userId?: string;
  decidedAt?: string;
}

const memorySessionsByUserCode = new Map<string, MemoryPairingRecord>();
const memorySessionsByDeviceCode = new Map<string, MemoryPairingRecord>();

function pruneMemorySessions() {
  const now = Date.now();
  for (const [code, sess] of memorySessionsByUserCode.entries()) {
    if (new Date(sess.expiresAt).getTime() < now) {
      memorySessionsByUserCode.delete(code);
      memorySessionsByDeviceCode.delete(sess.deviceCode);
    }
  }
}

export const PairingService = {
  /**
   * Initiate a pairing session for a client (CLI, sync daemon, mobile app).
   */
  async requestPairing(
    input: PairingRequestInput,
    baseUrl = 'https://www.kylrix.space'
  ): Promise<PairingSessionRecord> {
    const requestId = ID.unique();
    const deviceCode = `dev_${randomBytes(24).toString('base64url')}`;
    const userCode = generateHumanUserCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAIRING_EXPIRY_SECONDS * 1000);

    const clientName = input.clientName || 'Kylrix Client';
    const clientType = input.clientType || 'cli';
    const requestedScopes = normalizeScopes(input.requestedScopes);

    const requestMeta = JSON.stringify({
      isPairing: true,
      deviceCode,
      userCode,
      clientName,
      clientType,
      pairingMetadata: input.pairingMetadata || {},
    });

    const verificationUri = `${baseUrl}/pair`;
    const verificationUriComplete = `${baseUrl}/pair?code=${encodeURIComponent(userCode)}`;

    pruneMemorySessions();
    const memoryRecord: MemoryPairingRecord = {
      id: requestId,
      clientId: `pairing_${clientType}`,
      redirectUri: verificationUri,
      requestedScopes,
      deviceCode,
      userCode,
      status: 'pending',
      requestMeta,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    memorySessionsByUserCode.set(normalizeUserCode(userCode), memoryRecord);
    memorySessionsByDeviceCode.set(deviceCode, memoryRecord);

    try {
      if (process.env.APPWRITE_API_KEY) {
        const tables = createSystemTablesDB();
        await tables.createRow({
          databaseId: DB,
          tableId: REQUESTS_TABLE,
          rowId: requestId,
          data: {
            clientId: `pairing_${clientType}`,
            redirectUri: verificationUri,
            requestedScopes: JSON.stringify(requestedScopes),
            state: deviceCode, // state column stores the secret deviceCode
            nonce: userCode, // nonce column stores the human-friendly userCode
            responseType: 'punch_token',
            status: 'pending',
            requestMeta,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        });
      }
    } catch {
      // In standalone / self-host mode without Appwrite, in-memory store handles pairing cleanly
    }

    return shapePairingSession({
      id: requestId,
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete,
      expiresIn: PAIRING_EXPIRY_SECONDS,
      interval: POLLING_INTERVAL_SECONDS,
      clientName,
      clientType,
      requestedScopes,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  },

  /**
   * Look up a pairing request by userCode for web-based user confirmation.
   */
  async lookupByUserCode(userCode: string): Promise<{
    id: string;
    clientName: string;
    clientType: string;
    requestedScopes: string[];
    status: string;
    expiresAt: string;
  } | null> {
    const rawClean = userCode.trim().toUpperCase();
    const normalized = normalizeUserCode(rawClean);

    pruneMemorySessions();
    const mem = memorySessionsByUserCode.get(normalized) || memorySessionsByUserCode.get(rawClean);
    if (mem) {
      if (new Date(mem.expiresAt).getTime() < Date.now()) {
        mem.status = 'expired';
        return null;
      }
      let meta: any = {};
      try {
        meta = JSON.parse(mem.requestMeta || '{}');
      } catch {}

      return {
        id: mem.id,
        clientName: meta.clientName || 'Kylrix Client',
        clientType: meta.clientType || 'cli',
        requestedScopes: mem.requestedScopes,
        status: mem.status,
        expiresAt: mem.expiresAt,
      };
    }

    try {
      if (process.env.APPWRITE_API_KEY) {
        const tables = createSystemTablesDB();
        const codesToTry = [normalized];
        if (rawClean !== normalized) codesToTry.push(rawClean);

        for (const codeToSearch of codesToTry) {
          const res = await tables.listRows({
            databaseId: DB,
            tableId: REQUESTS_TABLE,
            queries: [
              Query.equal('nonce', codeToSearch),
              Query.limit(1),
            ],
          }).catch(() => ({ rows: [] as any[] }));

          const row = res.rows[0];
          if (row) {
            let meta: any = {};
            try {
              meta = JSON.parse(row.requestMeta || '{}');
            } catch {}

            if (!meta.isPairing) return null;

            return {
              id: row.$id,
              clientName: meta.clientName || 'Kylrix Client',
              clientType: meta.clientType || 'cli',
              requestedScopes: normalizeScopes(row.requestedScopes),
              status: row.status,
              expiresAt: row.expiresAt,
            };
          }
        }
      }
    } catch {}

    return null;
  },

  /**
   * User approves or denies the pairing request from their authenticated web session.
   */
  async decidePairing(params: {
    userCode: string;
    userId: string;
    action: 'approve' | 'deny';
    grantedScopes?: string[];
  }): Promise<{ ok: boolean; error?: string }> {
    const rawClean = params.userCode.trim().toUpperCase();
    const normalized = normalizeUserCode(rawClean);

    pruneMemorySessions();
    const mem = memorySessionsByUserCode.get(normalized) || memorySessionsByUserCode.get(rawClean);
    if (mem) {
      if (mem.status !== 'pending') {
        return { ok: false, error: `Pairing session has already been ${mem.status}.` };
      }
      if (new Date(mem.expiresAt).getTime() < Date.now()) {
        mem.status = 'expired';
        return { ok: false, error: 'Pairing session has expired.' };
      }

      if (params.action === 'deny') {
        mem.status = 'denied';
        mem.decidedAt = new Date().toISOString();
        return { ok: true };
      }

      const scopes = params.grantedScopes && params.grantedScopes.length > 0
        ? normalizeScopes(params.grantedScopes)
        : mem.requestedScopes;

      const finalScopes = scopes.length > 0 ? scopes : normalizeScopes(['*']);
      let meta: any = {};
      try {
        meta = JSON.parse(mem.requestMeta || '{}');
      } catch {}

      const clientName = meta.clientName || 'Paired Client';
      const { token, pat } = await PatService.create({
        userId: params.userId,
        name: `${clientName} (Punch Grant)`,
        scopes: finalScopes,
        keyCategory: 'punch_token',
      });

      mem.userId = params.userId;
      mem.status = 'approved';
      mem.decidedAt = new Date().toISOString();
      mem.requestMeta = JSON.stringify({
        ...meta,
        punchToken: token,
        punchPatId: pat.id,
        grantedUserId: params.userId,
        grantedScopes: finalScopes,
      });

      return { ok: true };
    }

    try {
      if (process.env.APPWRITE_API_KEY) {
        const tables = createSystemTablesDB();
        const codesToTry = [normalized];
        if (rawClean !== normalized) codesToTry.push(rawClean);

        let row: any = null;
        for (const codeToSearch of codesToTry) {
          const res = await tables.listRows({
            databaseId: DB,
            tableId: REQUESTS_TABLE,
            queries: [
              Query.equal('nonce', codeToSearch),
              Query.limit(1),
            ],
          }).catch(() => ({ rows: [] as any[] }));
          if (res.rows.length > 0) {
            row = res.rows[0];
            break;
          }
        }
        if (!row) {
          return { ok: false, error: 'Pairing session not found or expired.' };
        }

        if (row.status !== 'pending') {
          return { ok: false, error: `Pairing session has already been ${row.status}.` };
        }

        if (new Date(row.expiresAt).getTime() < Date.now()) {
          await tables.updateRow({
            databaseId: DB,
            tableId: REQUESTS_TABLE,
            rowId: row.$id,
            data: { status: 'expired' },
          }).catch(() => null);
          return { ok: false, error: 'Pairing session has expired.' };
        }

        if (params.action === 'deny') {
          await tables.updateRow({
            databaseId: DB,
            tableId: REQUESTS_TABLE,
            rowId: row.$id,
            data: {
              status: 'denied',
              decidedAt: new Date().toISOString(),
            },
          });
          return { ok: true };
        }

        let meta: any = {};
        try {
          meta = JSON.parse(row.requestMeta || '{}');
        } catch {}

        const scopes = params.grantedScopes && params.grantedScopes.length > 0
          ? normalizeScopes(params.grantedScopes)
          : normalizeScopes(row.requestedScopes);

        const finalScopes = scopes.length > 0 ? scopes : normalizeScopes(['*']);
        const clientName = meta.clientName || 'Paired Client';

        const { token, pat } = await PatService.create({
          userId: params.userId,
          name: `${clientName} (Punch Grant)`,
          scopes: finalScopes,
          keyCategory: 'punch_token',
        });

        const updatedMeta = JSON.stringify({
          ...meta,
          punchToken: token,
          punchPatId: pat.id,
          grantedUserId: params.userId,
          grantedScopes: scopes,
        });

        await tables.updateRow({
          databaseId: DB,
          tableId: REQUESTS_TABLE,
          rowId: row.$id,
          data: {
            userId: params.userId,
            status: 'approved',
            requestMeta: updatedMeta,
            decidedAt: new Date().toISOString(),
          },
        });

        return { ok: true };
      }
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to decide pairing' };
    }

    return { ok: false, error: 'Pairing session not found or expired.' };
  },

  /**
   * Client polls exchange with deviceCode to receive the punch token upon user approval.
   */
  async exchangeDeviceCode(deviceCode: string): Promise<PairingExchangeResult> {
    const cleanDeviceCode = deviceCode.trim();
    if (!cleanDeviceCode) {
      return { status: 'access_denied', error: 'device_code is required' };
    }

    pruneMemorySessions();
    const mem = memorySessionsByDeviceCode.get(cleanDeviceCode);
    if (mem) {
      if (new Date(mem.expiresAt).getTime() < Date.now() || mem.status === 'expired') {
        return { status: 'expired', error: 'Pairing code expired' };
      }

      if (mem.status === 'denied') {
        return { status: 'access_denied', error: 'User denied authorization' };
      }

      if (mem.status === 'pending') {
        return { status: 'authorization_pending' };
      }

      if (mem.status === 'approved') {
        let meta: any = {};
        try {
          meta = JSON.parse(mem.requestMeta || '{}');
        } catch {}

        const punchToken = meta.punchToken;
        if (!punchToken) {
          return { status: 'access_denied', error: 'Punch token missing from approval record' };
        }

        // One-time exchange burn: remove secret token
        meta.punchToken = '[exchanged]';
        meta.exchangedAt = new Date().toISOString();
        mem.requestMeta = JSON.stringify(meta);

        return {
          status: 'approved',
          token: punchToken,
          tokenType: 'Bearer',
          userId: mem.userId || 'user',
          scopes: meta.grantedScopes || mem.requestedScopes,
        };
      }
    }

    try {
      if (process.env.APPWRITE_API_KEY) {
        const tables = createSystemTablesDB();
        const res = await tables.listRows({
          databaseId: DB,
          tableId: REQUESTS_TABLE,
          queries: [
            Query.equal('state', cleanDeviceCode),
            Query.limit(1),
          ],
        }).catch(() => ({ rows: [] as any[] }));

        const row = res.rows[0];
        if (!row) {
          return { status: 'access_denied', error: 'Invalid device_code' };
        }

        if (new Date(row.expiresAt).getTime() < Date.now() || row.status === 'expired') {
          return { status: 'expired', error: 'Pairing code expired' };
        }

        if (row.status === 'denied') {
          return { status: 'access_denied', error: 'User denied authorization' };
        }

        if (row.status === 'pending') {
          return { status: 'authorization_pending' };
        }

        if (row.status === 'approved') {
          let meta: any = {};
          try {
            meta = JSON.parse(row.requestMeta || '{}');
          } catch {}

          const punchToken = meta.punchToken;
          if (!punchToken) {
            return { status: 'access_denied', error: 'Punch token missing from approval record' };
          }

          const sanitizedMeta = JSON.stringify({
            ...meta,
            punchToken: '[exchanged]',
            exchangedAt: new Date().toISOString(),
          });

          await tables.updateRow({
            databaseId: DB,
            tableId: REQUESTS_TABLE,
            rowId: row.$id,
            data: {
              requestMeta: sanitizedMeta,
            },
          }).catch(() => null);

          return {
            status: 'approved',
            token: punchToken,
            tokenType: 'Bearer',
            userId: row.userId,
            scopes: meta.grantedScopes || normalizeScopes(row.requestedScopes),
          };
        }
      }
    } catch {}

    return { status: 'access_denied', error: 'Invalid pairing session state' };
  },
};
