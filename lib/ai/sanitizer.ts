import type { Credentials } from "@/lib/appwrite/types";
import { AnalysisMode } from "./types";

/**
 * Privacy Filter Layer
 * Strips all sensitive fields before they leave the client context.
 * This is the primary firewall against data leaks.
 */
export class PrivacyFilter {
  
  static sanitize(mode: AnalysisMode, data: unknown): unknown {
    if (!data) return null;

    switch (mode) {
      case 'VAULT_ORGANIZE':
        // Input: Array of credentials
        // Output: Array of { id, name, url, currentFolder }
        // ABSOLUTELY NO PASSWORDS, USERNAMES, NOTES, OR CUSTOM FIELDS
        const list = Array.isArray(data) ? (data as Partial<Credentials>[]) : [(data as Partial<Credentials>)];
        return list.map((c: Partial<Credentials>) => ({
            id: c.$id,
            name: c.name,
            url: c.url,
            currentFolder: c.folderId
        }));

      case 'URL_SAFETY':
        // Input: Single Credential or URL string
        // Output: { url }
        if (typeof data === 'string') return { url: data };
        if (typeof data === 'object' && data !== null && 'url' in data) {
            return { url: (data as { url: string }).url };
        }
        return { url: '' };

      case 'PASSWORD_AUDIT':
        // Input: Single Credential or Password string
        // Output: { password } - WARNING: SENSITIVE
        // Only strictly allowed for ephemeral entropy analysis
        if (typeof data === 'string') return { password: data };
        if (typeof data === 'object' && data !== null && 'password' in data) {
            return { password: (data as { password: string }).password };
        }
        return { password: '' };
        
      case 'GENERAL_QUERY':
      case 'COMMAND_INTENT':
        // No data context allowed for general queries/commands to prevent accidental leakage
        return null;

      default:
        throw new Error(`Unsupported analysis mode: ${mode}`);
    }
  }
}
