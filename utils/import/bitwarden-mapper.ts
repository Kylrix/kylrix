import type { Credentials, TotpSecrets, Folders } from "@/lib/appwrite/types";
import type {
  BitwardenExport,
  BitwardenItem,
  BitwardenFolder,
} from "./bitwarden-types";
import { BITWARDEN_ITEM_TYPES } from "./bitwarden-types";
import { extractTotpFromBitwardenLogin } from "./totp-parser";

export interface ImportMapping {
  folders: Map<string, string>; // Bitwarden folder ID -> Our folder ID
  statistics: {
    totalItems: number;
    credentialsCount: number;
    totpCount: number;
    foldersCount: number;
    skippedItems: number;
  };
}

export interface MappedImportData {
  folders: Omit<Folders, "$id" | "$createdAt" | "$updatedAt">[];
  credentials: Omit<Credentials, "$id" | "$createdAt" | "$updatedAt">[];
  totpSecrets: Omit<TotpSecrets, "$id" | "$createdAt" | "$updatedAt">[];
  mapping: ImportMapping;
}

export function analyzeBitwardenExport(
  data: BitwardenExport,
  userId: string,
): MappedImportData {
  const folderMap = new Map<string, string>();
  const mappedFolders: Omit<Folders, "$id" | "$createdAt" | "$updatedAt">[] =
    [];
  const mappedCredentials: Omit<
    Credentials,
    "$id" | "$createdAt" | "$updatedAt"
  >[] = [];
  const mappedTotpSecrets: Omit<
    TotpSecrets,
    "$id" | "$createdAt" | "$updatedAt"
  >[] = [];

  let credentialsCount = 0;
  let totpCount = 0;
  let skippedItems = 0;

  // Map folders first
  data.folders.forEach((folder: BitwardenFolder) => {
    const mappedFolder: Omit<Folders, "$id" | "$createdAt" | "$updatedAt"> = {
      userId,
      name: folder.name,
      parentFolderId: null, // Bitwarden doesn't support nested folders by default
      icon: null,
      color: null,
      sortOrder: 0,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Omit<Folders, "$id" | "$createdAt" | "$updatedAt">;

    mappedFolders.push(mappedFolder);
    // We'll need to generate IDs when creating, store index for now
    folderMap.set(folder.id, `folder_${mappedFolders.length - 1}`);
  });

  // Map items
  data.items.forEach((item: BitwardenItem) => {
    try {
      // Skip non-login items for now (can be expanded later)
      if (item.type !== BITWARDEN_ITEM_TYPES.LOGIN || !item.login) {
        skippedItems++;
        return;
      }

      const baseCreatedAt = item.creationDate || new Date().toISOString();
      const baseUpdatedAt = item.revisionDate || new Date().toISOString();

      // Map folder ID
      let folderId: string | null = null;
      if (item.folderId && folderMap.has(item.folderId)) {
        folderId = folderMap.get(item.folderId)!;
      }

      // Extract URL from URIs
      let url: string | null = null;
      if (item.login.uris && item.login.uris.length > 0) {
        url = item.login.uris[0].uri;
      }

      // Handle custom fields
      let customFields: string | null = null;
      if (item.fields && item.fields.length > 0) {
        const fieldsObject = item.fields.reduce(
          (acc, field) => {
            acc[field.name] = field.value;
            return acc;
          },
          {} as Record<string, string>,
        );
        customFields = JSON.stringify(fieldsObject);
      }

      // Validate required fields for credential
      const username = item.login.username ? item.login.username.trim() : "";
      const password = item.login.password ? item.login.password.trim() : "";
      const name = item.name ? item.name.trim() : "";
      if (!username || !password || !name) {
        // Skip if any required field is missing or empty
        skippedItems++;
        console.warn(
          `Skipped item "${item.name}" due to missing required field(s):${!name ? " name" : ""}${!username ? " username" : ""}${!password ? " password" : ""}`,
        );
        return;
      }

      // Create credential entry
      const credential: Omit<Credentials, "$id" | "$createdAt" | "$updatedAt"> =
        {
          userId,
          itemType: "login",
          name,
          url,
          username,
          password,
          notes: item.notes,
          totpId: null,
          cardNumber: null,
          cardholderName: null,
          cardExpiry: null,
          cardCVV: null,
          cardPIN: null,
          cardType: null,
          folderId,
          tags: null, // Bitwarden doesn't have tags in this structure
          customFields,
          faviconUrl: null, // Could be derived from URL later
          isFavorite: item.favorite || false,
          isDeleted: false,
          deletedAt: null,
          lastAccessedAt: null,
          passwordChangedAt: null,
          createdAt: baseCreatedAt,
          updatedAt: baseUpdatedAt,
        } as unknown as Omit<Credentials, "$id" | "$createdAt" | "$updatedAt">;

      mappedCredentials.push(credential);
      credentialsCount++;

      // Extract TOTP if present
      const totpData = extractTotpFromBitwardenLogin(item.login, item.name);
      if (totpData) {
        const totpSecret: Omit<
          TotpSecrets,
          "$id" | "$createdAt" | "$updatedAt"
        > = {
          userId,
          issuer: totpData.issuer,
          accountName: totpData.accountName,
          secretKey: totpData.secretKey,
          algorithm: String(totpData.algorithm || "SHA1"),
          digits: Number(totpData.digits || 6),
          period: Number(totpData.period || 30),
          folderId,
          url, // Include URL for future autofilling
          tags: null,
          isFavorite: item.favorite || false,
          isDeleted: false,
          deletedAt: null,
          lastUsedAt: null,
          createdAt: baseCreatedAt,
          updatedAt: baseUpdatedAt,
        } as unknown as Omit<TotpSecrets, "$id" | "$createdAt" | "$updatedAt">;

        mappedTotpSecrets.push(totpSecret);
        totpCount++;
      }
    } catch (error: unknown) {
      console.error("Error mapping item:", item.name, error);
      skippedItems++;
    }
  });

  const mapping: ImportMapping = {
    folders: folderMap,
    statistics: {
      totalItems: data.items.length,
      credentialsCount,
      totpCount,
      foldersCount: mappedFolders.length,
      skippedItems,
    },
  };

  return {
    folders: mappedFolders,
    credentials: mappedCredentials,
    totpSecrets: mappedTotpSecrets,
    mapping,
  };
}

function extractIssuerFromName(name: string): string {
  // Try to extract a reasonable issuer name from the item name
  // Common patterns: "Google", "GitHub - Personal", "Amazon AWS", etc.
  const cleanName = name.replace(/\s*-\s*.*/g, "").trim(); // Remove everything after " - "
  return cleanName || name;
}

export function validateBitwardenExport(data: any): data is BitwardenExport {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.encrypted === "boolean" &&
    Array.isArray(data.folders) &&
    Array.isArray(data.items)
  );
}
