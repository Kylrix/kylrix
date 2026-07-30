import { npubToBytes, bytesToHex } from "./crypto";

interface TendonJson {
  names: Record<string, string>;
  vault_pointer?: {
    relays: string[];
    event_id: string;
    argon2_salt?: string;
  };
}

/**
 * Resolves a Tendon user identifier (username@domain.com or npub...)
 * to a hex public key string (32 bytes).
 */
export async function resolveIdentifier(identifier: string, defaultDomain?: string): Promise<{ npub: string; hex: string; source: string }> {
  let clean = identifier.trim();

  // If it's a plain username without "@", suffix it with defaultDomain or window.location.host
  if (!clean.startsWith("npub1") && !clean.includes("@")) {
    const domain = defaultDomain || (typeof window !== "undefined" ? window.location.host : "localhost:3005");
    clean = `${clean}@${domain}`;
  }

  // If it's an npub
  if (clean.startsWith("npub1")) {
    try {
      const bytes = npubToBytes(clean);
      return {
        npub: clean,
        hex: bytesToHex(bytes),
        source: "npub"};
    } catch (e) {
      throw new Error(`Failed to decode npub: ${(e as Error).message}`);
    }
  }

  // If it's an email/username@domain format
  if (clean.includes("@")) {
    const [username, domain] = clean.split("@");
    if (!username || !domain) {
      throw new Error("Invalid username@domain format");
    }

    // Determine scheme (http for localhost/development, https otherwise)
    const isDev = domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes(":") || domain.startsWith("192.168.");
    const scheme = isDev ? "http" : "https";
    const url = `${scheme}://${domain}/.well-known/tendon.json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = (await response.json()) as TendonJson;
      const targetNpub = data.names?.[username.toLowerCase()];
      if (!targetNpub) {
        throw new Error(`Username "${username}" not found in tendon.json names`);
      }

      const bytes = npubToBytes(targetNpub);
      return {
        npub: targetNpub,
        hex: bytesToHex(bytes),
        source: `${username}@${domain}`};
    } catch (e) {
      throw new Error(`Failed to resolve username from ${url}: ${(e as Error).message}`);
    }
  }

  throw new Error("Identifier must be either username@domain.com or npub...");
}
