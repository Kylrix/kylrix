import { Kylrix } from './index';

/**
 * Kylrix.Vault: The Secure State Store Module.
 * Domain: vault.kylrix.space
 */
export class KylrixVault {
  constructor(private sdk: Kylrix) {}

  /**
   * Retrieves all credentials for a user.
   * Note: Decryption must be handled by the application using KylrixSecurity.
   */
  async getCredentials(databaseId: string, tableId: string, queries: string[] = []) {
    return await this.sdk.listRows<any>(databaseId, tableId, queries);
  }

  /**
   * Securely saves a credential to the vault.
   * The data should be encrypted before calling this.
   */
  async saveCredential(databaseId: string, tableId: string, encryptedData: any) {
    return await this.sdk.createRow(databaseId, tableId, encryptedData);
  }

  /**
   * Fetches the user's vault master settings.
   */
  async getVaultSettings(databaseId: string, tableId: string, userId: string) {
    const results = await this.sdk.listRows<any>(databaseId, tableId, [
      `equal("userId", "${userId}")`
    ]);
    return results.documents[0] || null;
  }
}
