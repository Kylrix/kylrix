/**
 * Client-side Pairing Protocol Helper.
 * Used by CLI tools, self-hosted sync engines, and companion apps to execute
 * the RFC 8628-inspired pairing authorization flow.
 */

import type { PairingSessionRecord, PairingRequestInput } from '@/sdk/contracts/pairing';

export class PairingClient {
  private endpoint: string;

  constructor(endpoint = 'https://www.kylrix.space/api/v1') {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  /**
   * Request a new pairing session (returns userCode, deviceCode, verificationUri).
   */
  async requestPairing(input: PairingRequestInput): Promise<PairingSessionRecord> {
    const res = await fetch(`${this.endpoint}/pairing/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.data) {
      throw new Error(json?.error?.message || `Failed to initiate pairing: HTTP ${res.status}`);
    }

    return json.data as PairingSessionRecord;
  }

  /**
   * Poll for authorization approval until approved, denied, or timed out.
   */
  async pollExchange(
    deviceCode: string,
    opts?: {
      intervalSeconds?: number;
      timeoutSeconds?: number;
      onPoll?: (status: string) => void;
    }
  ): Promise<{ token: string; userId: string; scopes: string[] }> {
    const interval = (opts?.intervalSeconds ?? 5) * 1000;
    const timeout = (opts?.timeoutSeconds ?? 900) * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      opts?.onPoll?.('polling');
      const res = await fetch(`${this.endpoint}/pairing/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok && json?.data?.access_token) {
        return {
          token: json.data.access_token,
          userId: json.data.user_id,
          scopes: json.data.scopes || [],
        };
      }

      if (res.status === 428 || json?.error?.code === 'authorization_pending') {
        // Pending approval — wait interval and retry
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      }

      if (json?.error?.code === 'slow_down') {
        await new Promise((resolve) => setTimeout(resolve, interval + 5000));
        continue;
      }

      throw new Error(json?.error?.message || `Pairing rejected or failed: HTTP ${res.status}`);
    }

    throw new Error('Pairing session timed out waiting for user approval.');
  }
}
