import crypto from 'crypto';

/**
 * Verify Bachs webhook signature.
 *
 * Bachs delivers:
 *   - X-Bachs-Signature-V2: t={timestamp},v1={sig}[,v1={rotated_sig}]
 *   - or X-Bachs-Signature: {sig} and X-Bachs-Timestamp: {timestamp}
 *
 * Algorithm: HMAC-SHA256 hex digest over "{timestamp}.{rawBody}".
 * Tolerance window: 300 seconds.
 */
export function verifyBachsWebhookSignature(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
  secret?: string,
  toleranceSeconds = 300,
): boolean {
  const signingSecret = (secret || process.env.BACHS_WEBHOOK_SECRET || '').trim();
  if (!signingSecret) {
    if (process.env.NODE_ENV !== 'production' || process.env.BACHS_ALLOW_UNSIGNED_WEBHOOKS === 'true') {
      return true;
    }
    return false;
  }

  const getHeader = (name: string): string => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) || '';
    }
    const map = headers as Record<string, string | null | undefined>;
    return (
      map[name] ||
      map[name.toLowerCase()] ||
      map[name.toUpperCase()] ||
      ''
    );
  };

  const v2Header = getHeader('x-bachs-signature-v2');
  if (v2Header) {
    const parts = v2Header.split(',').reduce<Record<string, string[]>>((acc, pair) => {
      const [k, v] = pair.split('=');
      if (k && v) {
        acc[k] = acc[k] || [];
        acc[k].push(v);
      }
      return acc;
    }, {});

    const tsStr = parts.t?.[0];
    const signatures = parts.v1 || [];
    if (!tsStr || signatures.length === 0) return false;

    const timestamp = parseInt(tsStr, 10);
    if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
      return false;
    }

    const message = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', signingSecret).update(message, 'utf8').digest('hex');
    const expectedBuffer = Buffer.from(expected);

    return signatures.some((sig) => {
      try {
        const sigBuffer = Buffer.from(sig);
        return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, sigBuffer);
      } catch {
        return false;
      }
    });
  }

  // Legacy header fallback: X-Bachs-Signature and X-Bachs-Timestamp
  const timestampHeader = getHeader('x-bachs-timestamp');
  const signatureHeader = getHeader('x-bachs-signature');
  if (!timestampHeader || !signatureHeader) return false;

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false;
  }

  const message = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', signingSecret).update(message, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signatureHeader);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
