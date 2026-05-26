export interface NodeKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export class NodeKeyService {
  /**
   * Generates a cryptographically secure Ed25519 public and private keypair
   * representing the Node's Sovereign Identity.
   */
  static async generateNodeKeypair(): Promise<NodeKeypair> {
    const keys = await globalThis.crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    );
    return keys;
  }

  /**
   * Cryptographically signs a payload string using the Node's Private Key.
   * Resolves zero-trust authenticity checks between federated instances.
   */
  static async signPayload(payload: string, privateKey: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const signatureBuffer = await globalThis.crypto.subtle.sign(
      {
        name: 'Ed25519',
      },
      privateKey,
      encoder.encode(payload)
    );
    return Buffer.from(signatureBuffer).toString('hex');
  }

  /**
   * Cryptographically verifies a signature matching the payload using the Node's Public Key.
   */
  static async verifySignature(
    payload: string,
    signatureHex: string,
    publicKey: CryptoKey
  ): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const signature = Buffer.from(signatureHex, 'hex');
      return await globalThis.crypto.subtle.verify(
        {
          name: 'Ed25519',
        },
        publicKey,
        signature,
        encoder.encode(payload)
      );
    } catch {
      return false;
    }
  }
}
