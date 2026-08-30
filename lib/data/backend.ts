/** Supported data backends. Extend when adding PostgreSQL, SQLite, etc. */
export type DataBackendProvider = 'appwrite';

const DEFAULT_PROVIDER: DataBackendProvider = 'appwrite';

/** Resolve active backend from env (future: multi-backend routing). */
export function resolveDataBackendProvider(): DataBackendProvider {
  const raw = String(process.env.KYLRIX_DATA_BACKEND || DEFAULT_PROVIDER).trim().toLowerCase();
  if (raw === 'appwrite') return 'appwrite';
  return DEFAULT_PROVIDER;
}
