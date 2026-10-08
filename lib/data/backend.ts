/** Supported data backends: Turso (primary Drizzle/LibSQL) and Appwrite (opportunistic sync). */
export type DataBackendProvider = 'turso' | 'appwrite';

const DEFAULT_PROVIDER: DataBackendProvider = 'turso';

/** Resolve active backend from env (defaults to sovereign Turso backend). */
export function resolveDataBackendProvider(): DataBackendProvider {
  const raw = String(process.env.KYLRIX_DATA_BACKEND || DEFAULT_PROVIDER).trim().toLowerCase();
  if (raw === 'appwrite') return 'appwrite';
  return 'turso';
}
