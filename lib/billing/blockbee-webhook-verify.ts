import crypto from 'crypto';

/** Published BlockBee RSA public key (override via BLOCKBEE_WEBHOOK_PUBLIC_KEY_PEM). */
export const DEFAULT_BLOCKBEE_WEBHOOK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3FT0Ym8b3myVxhQW7ESuuu6lo
dGAsUJs4fq+Ey//jm27jQ7HHHDmP1YJO7XE7Jf/0DTEJgcw4EZhJFVwsk6d3+4fy
Bsn0tKeyGMiaE6cVkX0cy6Y85o8zgc/CwZKc0uw6d5siAo++xl2zl+RGMXCELQVE
ox7pp208zTvown577wIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Verify BlockBee checkout/IPN POST signature (RSA-SHA256 over raw body).
 * @see https://docs.blockbee.io/webhooks/verify-webhook-signature
 */
export function verifyBlockBeeWebhookPostSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  const sig = String(signatureHeader || '').trim();
  if (!sig || !rawBody) return false;

  try {
    const pem =
      process.env.BLOCKBEE_WEBHOOK_PUBLIC_KEY_PEM?.trim() || DEFAULT_BLOCKBEE_WEBHOOK_PUBLIC_KEY_PEM;

    const signature = Buffer.from(sig, 'base64');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(pem, signature);
  } catch {
    return false;
  }
}

export function blockBeeSignatureVerificationEnabled(): boolean {
  return process.env.BLOCKBEE_ALLOW_UNSIGNED_WEBHOOKS !== 'true';
}
