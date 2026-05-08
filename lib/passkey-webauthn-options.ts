/**
 * RP ID for assertions must match PasskeySetup registration (`rp.id`: kylrix.space).
 * Using `window.location.hostname` on subdomains breaks platform passkey selection.
 */
export function resolvePasskeyRpId(hostname: string): string {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return hostname;
  }
  if (hostname === "kylrix.space" || hostname.endsWith(".kylrix.space")) {
    return "kylrix.space";
  }
  return hostname;
}

const KNOWN_TRANSPORTS = new Set([
  "internal",
  "usb",
  "nfc",
  "ble",
  "hybrid",
]);

/** Prefer transports saved at registration; fallback keeps phones on platform UX. */
export function transportsForPasskeyEntry(entry: {
  params?: string | null;
}): AuthenticatorTransport[] {
  try {
    if (!entry.params) return ["internal"];
    const parsed = JSON.parse(entry.params) as { transports?: unknown };
    const raw = parsed?.transports;
    if (!Array.isArray(raw)) return ["internal"];
    const filtered = raw.filter(
      (x): x is AuthenticatorTransport =>
        typeof x === "string" && KNOWN_TRANSPORTS.has(x),
    );
    return filtered.length > 0 ? filtered : ["internal"];
  } catch {
    return ["internal"];
  }
}
