import { randomBytes } from 'crypto';
import { PatService } from '@/lib/services/pats';
import { normalizeScopes } from '@/lib/api/scopes';

const PAIRING_EXPIRY_SECONDS = 900;
const POLLING_INTERVAL_SECONDS = 5;

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
  async requestPairing(
    input: any,
    baseUrl = 'https://www.kylrix.space'
  ) {
    const requestId = crypto.randomUUID();
    const deviceCode = `dev_${randomBytes(24).toString('base64url')}`;
    const userCode = generateHumanUserCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAIRING_EXPIRY_SECONDS * 1000);

    const clientName = input.clientName || 'Kylrix Client';
    const clientType = input.clientType || 'cli';
    const requestedScopes = normalizeScopes(input.requestedScopes);

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
      requestMeta: JSON.stringify({
        isPairing: true,
        deviceCode,
        userCode,
        clientName,
        clientType,
      }),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    memorySessionsByUserCode.set(normalizeUserCode(userCode), memoryRecord);
    memorySessionsByDeviceCode.set(deviceCode, memoryRecord);

    return {
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
    };
  },

  async lookupByUserCode(userCode: string) {
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

    return null;
  },

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

    return { ok: false, error: 'Pairing session not found or expired.' };
  },

  async exchangeDeviceCode(deviceCode: string) {
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

    return { status: 'access_denied', error: 'Invalid pairing session state' };
  },
};
