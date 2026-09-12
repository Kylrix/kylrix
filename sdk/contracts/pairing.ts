/**
 * Canonical Pairing Protocol & Punch Grant Contract.
 * 
 * Provides RFC 8628-inspired device / pairing authorization for:
 * 1. CLI tools authenticating headlessly into Kylrix.
 * 2. Self-hosted instances pairing to Kylrix Cloud without manual token copy-pasting.
 * 3. Mobile companion apps scanning QR/short pairing codes.
 *
 * Flow:
 * 1. Client initiates: POST /api/v1/pairing/request -> receives deviceCode, userCode, verificationUri, pollInterval
 * 2. User approves: visits verificationUri with userCode, authenticates session, grants scopes
 * 3. Client polls: POST /api/v1/pairing/exchange -> returns user-scoped punch token (kyl_punch_...) with sliding refresh capability
 */

import { z } from 'zod';

export const PAIRING_STATUSES = ['pending', 'approved', 'denied', 'expired'] as const;
export type PairingStatus = (typeof PAIRING_STATUSES)[number];

export const pairingRequestInputZod = z.object({
  clientName: z.string().min(1).max(128).default('Kylrix Client'),
  clientType: z.enum(['cli', 'self_hosted_sync', 'mobile', 'daemon']).default('cli'),
  requestedScopes: z.array(z.string()).default([
    'profile:read',
    'notes:read',
    'notes:write',
    'goals:read',
    'goals:write',
    'tags:read',
    'tags:write',
    'forms:read',
    'forms:write',
    'events:read',
    'events:write',
    'workspaces:read',
    'workspaces:write',
    'objects:read',
    'objects:write',
  ]),
  pairingMetadata: z.record(z.unknown()).optional(),
});

export type PairingRequestInput = z.infer<typeof pairingRequestInputZod>;

export interface PairingSessionRecord {
  id: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
  clientName: string;
  clientType: string;
  requestedScopes: string[];
  status: PairingStatus;
  createdAt: string;
  expiresAt: string;
}

export interface PairingExchangeResult {
  status: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired' | 'approved';
  token?: string;
  tokenType?: 'Bearer';
  userId?: string;
  scopes?: string[];
  expiresAt?: string | null;
  error?: string;
}

export const PAIRING_SESSION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    deviceCode: { type: 'string', description: 'Secret token used by the client to poll exchange' },
    userCode: { type: 'string', description: 'Short human-friendly code shown to user (e.g. KYL-9482)' },
    verificationUri: { type: 'string', description: 'Web authorization endpoint on Cloud' },
    verificationUriComplete: { type: 'string', description: 'Pre-filled link with userCode for 1-click approval' },
    expiresIn: { type: 'number', description: 'Lifetime of pairing code in seconds' },
    interval: { type: 'number', description: 'Minimum poll interval in seconds' },
    clientName: { type: 'string' },
    clientType: { type: 'string' },
    requestedScopes: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['pending', 'approved', 'denied', 'expired'] },
  },
} as const;

export function shapePairingSession(row: {
  id: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
  clientName: string;
  clientType: string;
  requestedScopes: string[];
  status: PairingStatus;
  createdAt: string;
  expiresAt: string;
}): PairingSessionRecord {
  return {
    id: row.id,
    deviceCode: row.deviceCode,
    userCode: row.userCode,
    verificationUri: row.verificationUri,
    verificationUriComplete: row.verificationUriComplete,
    expiresIn: row.expiresIn,
    interval: row.interval,
    clientName: row.clientName,
    clientType: row.clientType,
    requestedScopes: row.requestedScopes,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
