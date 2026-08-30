export { resolveDataBackendProvider, type DataBackendProvider } from './backend';
export { getDatabase, Registry } from './db';
export { q, type QueryExpression } from './queries';
export { systemTables, overrideSystemTables, createRegistrySystemTables } from './system-tables';
export type { SystemTablesPort } from './system-tables.port';
export {
  tagsCacheKey,
  readLocalTagRows,
  writeLocalTagRows,
  upsertLocalTag,
  findLocalTagByName,
  mergeTagIntoRows,
  normalizeTagCachePayload,
  type TagCachePayload,
} from './local/tags';
