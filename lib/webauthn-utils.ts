// Sanitization block to clear broken password manager extensions on PublicKeyCredential prototype
if (typeof window !== 'undefined' && (window as any).PublicKeyCredential && (window as any).PublicKeyCredential.prototype.toJSON) {
  try {
    delete (window as any).PublicKeyCredential.prototype.toJSON;
  } catch (e) {
    console.error("Failed to clean up WebAuthn prototype bindings:", e);
  }
}

export function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function isWebAuthnGetAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    typeof navigator.credentials?.get === 'function'
  );
}

/** Native WebAuthn assertion (login only — vault unlock uses separate flows). */
export async function performNativePasskeyAuthentication(
  options: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isWebAuthnGetAvailable()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const publicKey: Record<string, unknown> = { ...options };
  publicKey.challenge = base64UrlToBuffer(options.challenge as string);

  const allowCreds = options.allowCredentials;
  if (Array.isArray(allowCreds) && allowCreds.length > 0) {
    publicKey.allowCredentials = allowCreds.map((c: Record<string, unknown>) => ({
      ...c,
      id: base64UrlToBuffer(c.id as string)}));
  } else {
    delete publicKey.allowCredentials;
  }

  const assertion = await navigator.credentials.get({
    publicKey: publicKey as unknown as PublicKeyCredentialRequestOptions});
  if (!assertion) {
    throw new Error('Authentication was not completed');
  }

  const credential = assertion as PublicKeyCredential;
  const response = credential.response as AuthenticatorAssertionResponse;

  const cleanPayload = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null},
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {}};

  return cleanPayload as unknown as Record<string, unknown>;
}

