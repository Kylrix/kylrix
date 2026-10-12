import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const SESSION_DIR = path.join(os.homedir(), '.kylrix');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

export interface VaultSession {
  mekHex: string;
  unlockedAt: number;
  expiresAt: number;
}

export function getVaultSession(): VaultSession | null {
  // Check environment variable first (like BW_SESSION)
  const envMek = process.env.KYLRIX_MEK_SESSION || process.env.KYLRIX_MEK;
  if (envMek) {
    return {
      mekHex: envMek,
      unlockedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };
  }

  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const session = JSON.parse(raw) as VaultSession;

    if (Date.now() > session.expiresAt) {
      clearVaultSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function setVaultSession(mekHex: string, expiresInMinutes = 60): VaultSession {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    const now = Date.now();
    const session: VaultSession = {
      mekHex,
      unlockedAt: now,
      expiresAt: now + expiresInMinutes * 60 * 1000,
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    return session;
  } catch (err: any) {
    throw new Error(`Failed to save vault session: ${err.message}`);
  }
}

export function clearVaultSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {}
}

export function isVaultUnlocked(): boolean {
  return getVaultSession() !== null;
}
