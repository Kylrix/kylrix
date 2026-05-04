export interface TotpParseResult {
  secretKey: string;
  issuer: string;
  accountName: string;
  algorithm: string;
  digits: number;
  period: number;
}

export function parseTotpUri(totpUri: string): TotpParseResult | null {
  try {
    // Handle different TOTP URI formats
    if (totpUri.startsWith("otpauth://totp/")) {
      return parseOtpauthUri(totpUri);
    }

    // If it's just a base32 secret, use defaults
    if (isBase32Secret(totpUri)) {
      return {
        secretKey: totpUri.toUpperCase(),
        issuer: "Unknown",
        accountName: "Unknown",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      };
    }

    return null;
  } catch (error: unknown) {
    console.error("Error parsing TOTP URI:", error);
    return null;
  }
}

function parseOtpauthUri(uri: string): TotpParseResult | null {
  try {
    const url = new URL(uri);

    if (url.protocol !== "otpauth:" || url.hostname !== "totp") {
      return null;
    }

    const pathParts = url.pathname.slice(1).split(":"); // Remove leading slash
    let issuer = "Unknown";
    let accountName = "Unknown";

    if (pathParts.length === 2) {
      issuer = decodeURIComponent(pathParts[0]);
      accountName = decodeURIComponent(pathParts[1]);
    } else if (pathParts.length === 1) {
      accountName = decodeURIComponent(pathParts[0]);
    }

    const secret = url.searchParams.get("secret");
    if (!secret) {
      return null;
    }

    // Override issuer if provided as parameter
    const issuerParam = url.searchParams.get("issuer");
    if (issuerParam) {
      issuer = decodeURIComponent(issuerParam);
    }

    const algorithm = url.searchParams.get("algorithm") || "SHA1";
    const digits = parseInt(url.searchParams.get("digits") || "6", 10);
    const period = parseInt(url.searchParams.get("period") || "30", 10);

    return {
      secretKey: secret.toUpperCase(),
      issuer,
      accountName,
      algorithm,
      digits,
      period,
    };
  } catch (error: unknown) {
    console.error("Error parsing otpauth URI:", error);
    return null;
  }
}

function isBase32Secret(input: string): boolean {
  // Base32 alphabet: A-Z, 2-7
  const base32Regex = /^[A-Z2-7]+=*$/;
  return base32Regex.test(input.toUpperCase()) && input.length >= 16;
}

export function extractTotpFromBitwardenLogin(
  login: { totp?: string | null; username?: string | null },
  itemName: string,
): TotpParseResult | null {
  if (!login.totp) {
    return null;
  }

  const parsed = parseTotpUri(login.totp);
  if (!parsed) {
    return null;
  }

  // Enhance with context from the item
  if (parsed.issuer === "Unknown") {
    parsed.issuer = extractIssuerFromName(itemName);
  }

  if (parsed.accountName === "Unknown" && login.username) {
    parsed.accountName = login.username;
  }

  return parsed;
}

function extractIssuerFromName(name: string): string {
  // Try to extract a reasonable issuer name from the item name
  // Common patterns: "Google", "GitHub - Personal", "Amazon AWS", etc.
  const cleanName = name.replace(/\s*-\s*.*/g, "").trim(); // Remove everything after " - "
  return cleanName || name;
}

export function generateTotpCode(secret: string, timestamp?: number): string {
  // This would need a TOTP library implementation
  // For now, return a placeholder - you'd implement actual TOTP generation here
  // using libraries like 'otplib' or similar
  return "000000";
}

export function validateTotpSecret(secret: string): boolean {
  return isBase32Secret(secret);
}
