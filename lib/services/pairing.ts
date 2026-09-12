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
import { normalizeScopes, type PatScope } from '@/lib/api/scopes';
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
 * Generate a clean, human-friendly 8-character code formatted as KYL-XXXX.
 * Omits ambiguous characters (0, O, 1, I, L) for error-free mobile & terminal input.
 */
function generateHumanUserCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let randomStr = '';
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `KYL-${randomStr}`;
}

export const PairingService = {
  /**
   * Initiate a pairing session for a client (CLI, sync daemon, mobile app).
   */
  async requestPairing(
    input: PairingRequestInput,
    baseUrl = 'https://www.kylrix.space'
  ): Promise<PairingSessionRecord> {
    const tables = createSystemTablesDB();
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
    const cleanCode = userCode.trim().toUpperCase();
    const tables = createSystemTablesDB();

    const res = await tables.listRows({
      databaseId: DB,
      tableId: REQUESTS_TABLE,
      queries: [
        Query.equal('nonce', cleanCode),
        Query.limit(1),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    const row = res.rows[0];
    if (!row) return null;

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
    const cleanCode = params.userCode.trim().toUpperCase();
    const tables = createSystemTablesDB();

    const res = await tables.listRows({
      databaseId: DB,
      tableId: REQUESTS_TABLE,
      queries: [
        Query.equal('nonce', cleanCode),
        Query.limit(1),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    const row = res.rows[0];
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

    // Approve action: Mint a user-scoped punch token
    let meta: any = {};
    try {
      meta = JSON.parse(row.requestMeta || '{}');
    } catch {}

    const scopes = params.grantedScopes && params.grantedScopes.length > 0
      ? params.grantedScopes
      : normalizeScopes(row.requestedScopes);

    const clientName = meta.clientName || 'Paired Client';

    // Create a punch token using PatService
    const { token, pat } = await PatService.create({
      userId: params.userId,
      name: `${clientName} (Punch Grant)`,
      scopes: scopes as PatScope[],
      keyCategory: 'punch_token',
    });

    // Update request row with user id, approved status, and punch token payload
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
  },

  /**
   * Client polls exchange with deviceCode to receive the punch token upon user approval.
   */
  async exchangeDeviceCode(deviceCode: string): Promise<PairingExchangeResult> {
    const cleanDeviceCode = deviceCode.trim();
    if (!cleanDeviceCode) {
      return { status: 'access_denied', error: 'device_code is required' };
    }

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

      // One-time exchange burn: remove secret token from row metadata to prevent replay leaks
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

    return { status: 'access_denied', error: 'Invalid pairing session state' };
  },
};
