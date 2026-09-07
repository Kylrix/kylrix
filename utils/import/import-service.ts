import { createFolder, AppwriteService } from "@/lib/appwrite";
import { VaultService } from "@/lib/appwrite/vault-service";
import type { Credentials, TotpSecrets, Folders } from "@/lib/appwrite/types";
import type { BitwardenExport } from "./bitwarden-types";
import {
  analyzeBitwardenExport,
  validateBitwardenExport,
  type MappedImportData,
} from "./bitwarden-mapper";
import { DeduplicationEngine } from "@/lib/import/deduplication";
import {
  kickImportSync,
  startImportBatch,
} from "@/lib/vault/import-local-batch";

export interface ImportProgress {
  stage: "parsing" | "folders" | "credentials" | "totp" | "completed" | "error";
  currentStep: number;
  totalSteps: number;
  message: string;
  itemsProcessed: number;
  itemsTotal: number;
  errors: string[];
}

export interface ImportResult {
  success: boolean;
  summary: {
    foldersCreated: number;
    credentialsCreated: number;
    totpSecretsCreated: number;
    errors: number;
    skipped: number;
    skippedExisting: number;
  };
  errors: string[];
  folderMapping: Map<string, string>;
}

export class ImportService {
  private progressCallback?: (progress: ImportProgress) => void;

  constructor(progressCallback?: (progress: ImportProgress) => void) {
    this.progressCallback = progressCallback;
  }

  async importBitwardenData(
    jsonData: string,
    userId: string,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      summary: {
        foldersCreated: 0,
        credentialsCreated: 0,
        totpSecretsCreated: 0,
        errors: 0,
        skipped: 0,
        skippedExisting: 0,
      },
      errors: [],
      folderMapping: new Map(),
    };

    try {
      // Stage 1: Parse and validate JSON
      this.updateProgress({
        stage: "parsing",
        currentStep: 1,
        totalSteps: 4,
        message: "Parsing JSON data...",
        itemsProcessed: 0,
        itemsTotal: 0,
        errors: [],
      });

      const parsedData = JSON.parse(jsonData);

      if (!validateBitwardenExport(parsedData)) {
        throw new Error("Invalid Bitwarden export format");
      }

      const bitwardenData: BitwardenExport = parsedData;
      const mappedData = analyzeBitwardenExport(bitwardenData, userId);

      // Enhanced error handling for empty or skipped credentials
      if (mappedData.credentials.length === 0) {
        let errorMsg =
          "No login credentials found in file. Make sure you exported your vault as JSON and that it contains login items.";
        if (mappedData.mapping.statistics.skippedItems > 0) {
          errorMsg += ` ${mappedData.mapping.statistics.skippedItems} item(s) were skipped. Only items of type 'login' with valid login data are imported.`;
        }
        throw new Error(errorMsg);
      }

      const totalItems =
        mappedData.folders.length +
        mappedData.credentials.length +
        mappedData.totpSecrets.length;

      // Check against existing data (Credentials, Folders, TOTP)
      this.updateProgress({
        stage: "parsing",
        currentStep: 1,
        totalSteps: 4,
        message: "Checking for existing data...",
        itemsProcessed: 0,
        itemsTotal: totalItems,
        errors: [],
      });

      const existingFoldersMap = new Map<string, string>(); // Name -> ID

      try {
        const { sanitizeImportBundle, loadExistingVaultForDedupe } = await import(
          '@/lib/porter/sanitize-import'
        );
        const existing = await loadExistingVaultForDedupe(userId);
        const sanitized = sanitizeImportBundle(
          {
            credentials: mappedData.credentials as any[],
            totpSecrets: mappedData.totpSecrets as any[],
            workspaces: mappedData.folders as any[],
            folders: mappedData.folders as any[],
          },
          existing,
        );
        mappedData.credentials = sanitized.credentials as any;
        mappedData.totpSecrets = sanitized.totpSecrets as any;
        mappedData.folders = sanitized.workspaces as any;
        result.summary.skipped = sanitized.skippedInvalid;
        result.summary.skippedExisting =
          sanitized.skippedDuplicate + sanitized.skippedDuplicateIncoming;
        if (sanitized.skippedInvalid > 0) {
          result.errors.push(
            `Dropped ${sanitized.skippedInvalid} unreadable item(s).`,
          );
        }

        const existingFolders = await AppwriteService.listFolders(userId);
        existingFolders.forEach((f: any) => {
          if (f.name) existingFoldersMap.set(f.name.trim(), f.$id);
        });
      } catch (e: unknown) {
        console.warn("[ImportService] Failed to check existing data, proceeding with import.", e);
      }

      // Stage 2: Import folders
      this.updateProgress({
        stage: "folders",
        currentStep: 2,
        totalSteps: 4,
        message: "Creating workspaces...",
        itemsProcessed: 0,
        itemsTotal: totalItems,
        errors: [],
      });

      const folderIdMapping = await this.importFolders(
        mappedData.folders,
        mappedData,
        existingFoldersMap
      );
      result.folderMapping = folderIdMapping;
      result.summary.foldersCreated = folderIdMapping.size;

      // Stage 3: Import credentials
      this.updateProgress({
        stage: "credentials",
        currentStep: 3,
        totalSteps: 4,
        message: "Saving secrets privately…",
        itemsProcessed: result.summary.foldersCreated,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      const credentialsResult = await this.importCredentials(
        mappedData.credentials,
        folderIdMapping,
      );
      result.summary.credentialsCreated = credentialsResult.created;
      result.summary.errors += credentialsResult.errors;
      result.errors.push(...credentialsResult.errorMessages);

      // Stage 4: Import TOTP secrets
      this.updateProgress({
        stage: "totp",
        currentStep: 4,
        totalSteps: 4,
        message: "Saving smart codes privately…",
        itemsProcessed:
          result.summary.foldersCreated + result.summary.credentialsCreated,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      const totpResult = await this.importTotpSecrets(
        mappedData.totpSecrets,
        folderIdMapping,
      );
      result.summary.totpSecretsCreated = totpResult.created;
      result.summary.errors += totpResult.errors;
      result.errors.push(...totpResult.errorMessages);

      // Completed
      result.success =
        result.summary.errors === 0 ||
        result.summary.credentialsCreated + result.summary.totpSecretsCreated >
        0;
      result.summary.skipped = mappedData.mapping.statistics.skippedItems;

      this.updateProgress({
        stage: "completed",
        currentStep: 4,
        totalSteps: 4,
        message: `Saved locally — syncing in the background (${result.summary.credentialsCreated} secrets, ${result.summary.totpSecretsCreated} codes)`,
        itemsProcessed: totalItems,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      result.errors.push(errorMessage);

      this.updateProgress({
        stage: "error",
        currentStep: 0,
        totalSteps: 4,
        message: `Import failed: ${errorMessage}`,
        itemsProcessed: 0,
        itemsTotal: 0,
        errors: result.errors,
      });

      return result;
    }
  }

  async importKylrixVaultData(
    jsonData: string,
    userId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      summary: {
        foldersCreated: 0,
        credentialsCreated: 0,
        totpSecretsCreated: 0,
        errors: 0,
        skipped: 0,
        skippedExisting: 0,
      },
      errors: [],
      folderMapping: new Map(),
    };

    try {
      // Stage 1: Parse
      this.updateProgress({
        stage: "parsing",
        currentStep: 1,
        totalSteps: 4,
        message: "Parsing Kylrix Vault data...",
        itemsProcessed: 0,
        itemsTotal: 0,
        errors: [],
      });

      const parsedData = JSON.parse(jsonData);

      // Basic validation — support top-level or data.vault exports
      const vaultBlock = parsedData?.data?.vault;
      if (
        !parsedData.version &&
        !parsedData.credentials &&
        !parsedData.totpSecrets &&
        !parsedData.folders &&
        !parsedData.workspaces &&
        !vaultBlock
      ) {
        throw new Error("Invalid Kylrix Vault export format");
      }

      const { sanitizeImportBundle, loadExistingVaultForDedupe } = await import(
        '@/lib/porter/sanitize-import'
      );
      const existing = await loadExistingVaultForDedupe(userId);
      const sanitized = sanitizeImportBundle(parsedData, existing);

      let folders = sanitized.workspaces;
      let credentials = sanitized.credentials;
      let totpSecrets = sanitized.totpSecrets;

      result.summary.skipped = sanitized.skippedInvalid;
      result.summary.skippedExisting =
        sanitized.skippedDuplicate + sanitized.skippedDuplicateIncoming;

      if (sanitized.skippedInvalid > 0) {
        result.errors.push(
          `Dropped ${sanitized.skippedInvalid} unreadable item(s) (e.g. decryption placeholders).`,
        );
      }

      const existingFoldersMap = new Map<string, string>(); // Name -> ID
      try {
        const existingFolders = await AppwriteService.listFolders(userId);
        existingFolders.forEach((f: any) => {
          if (f.name) existingFoldersMap.set(f.name.trim(), f.$id);
        });
      } catch {}

      // Legacy smart-merge still helps noisy batches after sanitize
      try {
        const mergedIncoming = DeduplicationEngine.processSmartMerge(
          credentials.map((c: any) => ({ ...c, _status: 'new' })),
        );
        credentials = mergedIncoming as any;
      } catch {}

      console.log("[ImportService] Parsed Kylrix Vault data:", {
        foldersCount: folders.length,
        credentialsCount: credentials.length,
        totpSecretsCount: totpSecrets.length,
        skippedInvalid: sanitized.skippedInvalid,
        skippedExisting: result.summary.skippedExisting,
        firstCredential: credentials[0] ? JSON.stringify(credentials[0]).substring(0, 200) : "NONE"
      });

      const totalItems = folders.length + credentials.length + totpSecrets.length;

      // Stage 2: Import workspaces (legacy vault folders table)
      this.updateProgress({
        stage: "folders",
        currentStep: 2,
        totalSteps: 4,
        message: "Restoring workspaces...",
        itemsProcessed: 0,
        itemsTotal: totalItems,
        errors: [],
      });

      const folderIdMapping = new Map<string, string>();

      for (const folder of folders) {
        await this.throttle();
        try {
          const folderName = folder.name ? folder.name.trim() : "";
          let folderId: string;

          if (folderName && existingFoldersMap.has(folderName)) {
             folderId = existingFoldersMap.get(folderName)!;
          } else {
              // Clean folder object for creation
              const cleanFolder = {
                name: folder.name,
                // userId is handled by createFolder using current user
              };
              const created = await createFolder({
                ...cleanFolder,
                userId
              } as any);
              folderId = created.$id;
              result.summary.foldersCreated++;
              if (folderName) existingFoldersMap.set(folderName, folderId);
          }

          // Map old ID to new ID
          if (folder.$id) {
            folderIdMapping.set(folder.$id, folderId);
          }
        } catch (e: unknown) {
          console.error("Failed to restore folder", e);
        }
      }
      result.folderMapping = folderIdMapping;

      // Stage 3: Import credentials (LocalEngine-first ciphertext + high-priority sync)
      this.updateProgress({
        stage: "credentials",
        currentStep: 3,
        totalSteps: 4,
        message: "Saving secrets privately…",
        itemsProcessed: result.summary.foldersCreated,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      const batchId = await startImportBatch(userId);

      for (let i = 0; i < credentials.length; i++) {
        const cred = credentials[i];
        if (i > 0 && i % 12 === 0) await this.yieldUi();
        try {
          if (!cred.name || !String(cred.name).trim()) {
            throw new Error("Credential name is missing");
          }

          const cleanCred = this.cleanCredentialForCreate(cred, folderIdMapping, userId);
          await VaultService.stageCredentialImport(cleanCred as any, { batchId });
          result.summary.credentialsCreated++;
          if (result.summary.credentialsCreated % 24 === 0) kickImportSync(userId);

          this.updateProgress({
            stage: "credentials",
            currentStep: 3,
            totalSteps: 4,
            message: `Saving secrets privately… (${result.summary.credentialsCreated}/${credentials.length})`,
            itemsProcessed: result.summary.foldersCreated + result.summary.credentialsCreated,
            itemsTotal: totalItems,
            errors: result.errors,
          });
        } catch (e: unknown) {
          const error = e as Error;
          result.summary.errors++;
          const errorMsg = `Failed to restore credential ${cred.name || 'Unknown'}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`Import Error [Credential]: ${errorMsg}`, e);
        }
      }

      // Stage 4: TOTP Secrets — same local-first path
      this.updateProgress({
        stage: "totp",
        currentStep: 4,
        totalSteps: 4,
        message: "Saving smart codes privately…",
        itemsProcessed: result.summary.foldersCreated + result.summary.credentialsCreated,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      for (let i = 0; i < totpSecrets.length; i++) {
        const totp = totpSecrets[i];
        if (i > 0 && i % 12 === 0) await this.yieldUi();
        try {
          let folderId = totp.folderId;
          if (folderId && folderIdMapping.has(folderId)) {
            folderId = folderIdMapping.get(folderId);
          } else {
            folderId = null;
          }

          const cleanTotp = {
            issuer: totp.issuer,
            accountName: totp.accountName,
            secretKey: totp.secretKey,
            algorithm: totp.algorithm,
            digits: totp.digits,
            period: totp.period,
            url: totp.url,
            folderId: folderId,
            tags: totp.tags,
            isFavorite: totp.isFavorite || false,
            isDeleted: totp.isDeleted || false,
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await VaultService.stageTotpImport(cleanTotp as any, { batchId });
          result.summary.totpSecretsCreated++;
          if (result.summary.totpSecretsCreated % 24 === 0) kickImportSync(userId);

          this.updateProgress({
            stage: "totp",
            currentStep: 4,
            totalSteps: 4,
            message: `Saving smart codes privately… (${result.summary.totpSecretsCreated}/${totpSecrets.length})`,
            itemsProcessed:
              result.summary.foldersCreated +
              result.summary.credentialsCreated +
              result.summary.totpSecretsCreated,
            itemsTotal: totalItems,
            errors: result.errors,
          });
        } catch (_e: unknown) {
          result.summary.errors++;
          result.errors.push(`Failed to restore TOTP ${totp.issuer}`);
        }
      }

      kickImportSync(userId);

      result.success = true;

      this.updateProgress({
        stage: "completed",
        currentStep: 4,
        totalSteps: 4,
        message: "Saved locally — syncing in the background",
        itemsProcessed: totalItems,
        itemsTotal: totalItems,
        errors: result.errors,
      });

      return result;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      result.errors.push(errorMessage);

      this.updateProgress({
        stage: "error",
        currentStep: 0,
        totalSteps: 4,
        message: `Import failed: ${errorMessage}`,
        itemsProcessed: 0,
        itemsTotal: 0,
        errors: result.errors,
      });

      return result;
    }
  }

  private normalizeUrl(url?: string | null): string {
    if (!url) return "";
    try {
      // Remove protocol and www.
      let normalized = url.trim().toLowerCase();
      normalized = normalized.replace(/^(https?:\/\/)?(www\.)?/, "");
      // Remove trailing slash
      normalized = normalized.replace(/\/$/, "");
      return normalized;
    } catch {
      return (url || "").toLowerCase();
    }
  }

  private async yieldUi() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  private async throttle() {
    // Kept for folder creates (few). Item imports use LocalEngine-first + yieldUi.
    await new Promise(resolve => setTimeout(resolve, 120));
  }

  private async importFolders(
    folders: Omit<Folders, "$id" | "$createdAt" | "$updatedAt">[],
    mappedData: MappedImportData,
    existingFoldersMap?: Map<string, string>
  ): Promise<Map<string, string>> {
    const folderIdMapping = new Map<string, string>();

    // Pre-populate with existing folders if available
    if (existingFoldersMap) {
        existingFoldersMap.forEach((id, name) => {
            folderIdMapping.set(name, id);
        });
    }

    for (let i = 0; i < folders.length; i++) {
      await this.throttle(); // Throttle
      try {
        const folder = folders[i];
        const folderName = folder.name.trim();
        
        let folderId: string;

        // Check if folder already exists
        if (existingFoldersMap && existingFoldersMap.has(folderName)) {
            folderId = existingFoldersMap.get(folderName)!;
        } else {
            const createdFolder = await createFolder(folder);
            folderId = createdFolder.$id;
            // Update map for subsequent lookups
            if (existingFoldersMap) existingFoldersMap.set(folderName, folderId);
        }

        // Map the original placeholder ID to the real ID
        const placeholderId = `folder_${i}`;
        folderIdMapping.set(placeholderId, folderId);

        // Also map by name for convenience
        folderIdMapping.set(folder.name, folderId);
      } catch (error: unknown) {
        console.error("Failed to create/map folder:", folders[i].name, error);
        // Continue with other folders
      }
    }

    return folderIdMapping;
  }

  private async importCredentials(
    credentials: Omit<Credentials, "$id" | "$createdAt" | "$updatedAt">[],
    folderIdMapping: Map<string, string>,
  ): Promise<{ created: number; errors: number; errorMessages: string[] }> {
    let created = 0;
    let errors = 0;
    const errorMessages: string[] = [];
    const userId = String((credentials[0] as any)?.userId || "");
    const batchId = await startImportBatch(userId || "import");

    for (let i = 0; i < credentials.length; i++) {
      if (i > 0 && i % 12 === 0) await this.yieldUi();
      try {
        const credential = credentials[i];
        const cleanCred = this.cleanCredentialForCreate(credential, folderIdMapping, credential.userId);

        await VaultService.stageCredentialImport(cleanCred as any, { batchId });
        created++;
        if (userId && created % 24 === 0) kickImportSync(userId);

        this.updateProgress({
          stage: "credentials",
          currentStep: 3,
          totalSteps: 4,
          message: `Saving secrets privately… (${created}/${credentials.length})`,
          itemsProcessed: folderIdMapping.size + created,
          itemsTotal: folderIdMapping.size + credentials.length,
          errors: errorMessages,
        });
      } catch (error: unknown) {
        errors++;
        const errorMsg = `Failed to import credential "${credentials[i].name}": ${error instanceof Error ? error.message : "Unknown error"}`;
        errorMessages.push(errorMsg);
        console.error(errorMsg);
      }
    }

    if (userId) kickImportSync(userId);
    return { created, errors, errorMessages };
  }

  private async importTotpSecrets(
    totpSecrets: Omit<TotpSecrets, "$id" | "$createdAt" | "$updatedAt">[],
    folderIdMapping: Map<string, string>,
  ): Promise<{ created: number; errors: number; errorMessages: string[] }> {
    let created = 0;
    let errors = 0;
    const errorMessages: string[] = [];
    const userId = String((totpSecrets[0] as any)?.userId || "");
    const batchId = await startImportBatch(userId || "import");

    for (let i = 0; i < totpSecrets.length; i++) {
      if (i > 0 && i % 12 === 0) await this.yieldUi();
      try {
        const totpSecret = { ...totpSecrets[i] };

        if (totpSecret.folderId && folderIdMapping.has(totpSecret.folderId)) {
          totpSecret.folderId = folderIdMapping.get(totpSecret.folderId)!;
        } else {
          totpSecret.folderId = null;
        }

        await VaultService.stageTotpImport(totpSecret as any, { batchId });
        created++;
        if (userId && created % 24 === 0) kickImportSync(userId);

        this.updateProgress({
          stage: "totp",
          currentStep: 4,
          totalSteps: 4,
          message: `Saving smart codes privately… (${created}/${totpSecrets.length})`,
          itemsProcessed: folderIdMapping.size + created,
          itemsTotal: folderIdMapping.size + totpSecrets.length,
          errors: errorMessages,
        });
      } catch (error: unknown) {
        errors++;
        const errorMsg = `Failed to import TOTP secret "${totpSecrets[i].issuer}": ${error instanceof Error ? error.message : "Unknown error"}`;
        errorMessages.push(errorMsg);
        console.error(errorMsg);
      }
    }

    if (userId) kickImportSync(userId);
    return { created, errors, errorMessages };
  }

  private updateProgress(progress: ImportProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  private cleanCredentialForCreate(cred: any, folderIdMapping: Map<string, string>, userId: string) {
    const usernameRaw = cred.username != null ? String(cred.username).trim() : '';
    const passwordRaw = cred.password != null ? String(cred.password).trim() : '';
    const clean: any = {
      userId: userId,
      itemType: cred.itemType || "login",
      name: String(cred.name || "").substring(0, 255),
      username: usernameRaw ? usernameRaw.substring(0, 255) : null,
      password: passwordRaw ? passwordRaw.substring(0, 1000) : null,
      isFavorite: cred.isFavorite || false,
      isDeleted: cred.isDeleted || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (cred.url && typeof cred.url === 'string' && cred.url.trim()) clean.url = cred.url.trim();
    if (cred.notes && typeof cred.notes === 'string' && cred.notes.trim()) clean.notes = cred.notes.trim();

    // Map folder ID
    if (cred.folderId && folderIdMapping.has(cred.folderId)) {
      clean.folderId = folderIdMapping.get(cred.folderId);
    }

    // Map tags
    if (cred.tags && Array.isArray(cred.tags) && cred.tags.length > 0) {
      clean.tags = cred.tags;
    }

    // Custom Fields
    if (cred.customFields) {
      if (typeof cred.customFields === 'string' && cred.customFields.trim()) {
        clean.customFields = cred.customFields;
      } else if (typeof cred.customFields === 'object') {
        clean.customFields = JSON.stringify(cred.customFields);
      }
    }

    // Optional fields - only include if truthy
    if (cred.totpId) clean.totpId = cred.totpId;
    if (cred.cardNumber) clean.cardNumber = cred.cardNumber;
    if (cred.cardholderName) clean.cardholderName = cred.cardholderName;
    if (cred.cardExpiry) clean.cardExpiry = cred.cardExpiry;
    if (cred.cardCVV) clean.cardCVV = cred.cardCVV;
    if (cred.cardPIN) clean.cardPIN = cred.cardPIN;
    if (cred.cardType) clean.cardType = cred.cardType;
    if (cred.faviconUrl) clean.faviconUrl = cred.faviconUrl;

    return clean;
  }
}

// Security logging for imports
