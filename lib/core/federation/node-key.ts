import { generateKeyPairSync, createSign, createVerify } from 'node:crypto';

export interface NodeKeypair {
  publicKey: string;
  privateKey: string;
}

export class NodeKeyService {
  /**
   * Generates a cryptographically secure Ed25519 public and private keypair
   * representing the Node's Sovereign Identity.
   */
  static generateNodeKeypair(): NodeKeypair {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
      publicKey,
      privateKey,
    };
  }

  /**
   * Cryptographically signs a payload string using the Node's Private Key.
   * Resolves zero-trust authenticity checks between federated instances.
   */
  static signPayload(payload: string, privateKeyPem: string): string {
    const sign = createSign('SHA256');
    sign.update(payload);
    sign.end();
    return sign.sign(privateKeyPem, 'hex');
  }

  /**
   * Cryptographically verifies a signature matching the payload using the Node's Public Key.
   */
  static verifySignature(
    payload: string,
    signatureHex: string,
    publicKeyPem: string
  ): boolean {
    try {
      const verify = createVerify('SHA256');
      verify.update(payload);
      verify.end();
      return verify.verify(publicKeyPem, signatureHex, 'hex');
    } catch {
      return false;
    }
  }
}
