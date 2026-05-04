export function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function publicKeyCredentialToJSON(pubKeyCred: unknown): unknown {
  if (Array.isArray(pubKeyCred)) return (pubKeyCred as unknown[]).map(publicKeyCredentialToJSON);
  if (pubKeyCred instanceof ArrayBuffer) return bufferToBase64Url(pubKeyCred);
  if (pubKeyCred && typeof pubKeyCred === 'object') {
    const obj: Record<string, unknown> = {};
    const cred = pubKeyCred as Record<string, unknown>;
    
    for (const key in cred) {
      try {
        const val = cred[key];
        obj[key] = publicKeyCredentialToJSON(val);
      } catch (_e: unknown) {
        // Skip properties that can't be serialized (e.g., password manager proxy methods)
        // This allows credentials from problematic password managers to still be processed
      }
    }
    return obj;
  }
  return pubKeyCred;
}
