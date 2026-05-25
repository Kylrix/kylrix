type VaultSdk = {
  listRows: <T = unknown>(databaseId: string, tableId: string, queries?: string[]) => Promise<{ documents: T[] } & Record<string, unknown>>;
  createRow: (databaseId: string, tableId: string, data: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Kylrix.Vault: The Secure State Store Module.
 * Domain: vault.kylrix.space
 */
export class KylrixVault {
  constructor(private sdk: VaultSdk) {}

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
    return results.rows[0] || null;
  }
}
