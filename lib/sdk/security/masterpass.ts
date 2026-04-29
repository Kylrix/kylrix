import { KylrixSecurity } from '../security';

export async function deriveMasterpassKey(password: string, salt: string) {
  return KylrixSecurity.deriveKey(password, salt);
}

export async function encryptMasterpassPayload(payload: string, password: string, salt: string) {
  const key = await deriveMasterpassKey(password, salt);
  return KylrixSecurity.encrypt(payload, key);
}

export async function decryptMasterpassPayload(cipher: string, iv: string, password: string, salt: string) {
  const key = await deriveMasterpassKey(password, salt);
  return KylrixSecurity.decrypt(cipher, iv, key);
}
