import { Client, Account, Databases, Messaging, Storage, Users, TablesDB } from 'node-appwrite';
import { PROJECT_ID, ENDPOINT } from '../generated/appwrite/constants';

/**
 * Creates an admin client with full permissions.
 * ALWAYS use this on the server only.
 */
export function createAdminClient() {
  const client = new Client();
  const apiKey = process.env.APPWRITE_API;
  
  if (!apiKey) {
    console.error('[Admin Client] APPWRITE_API environment variable is missing.');
  }

  client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey || '');

    return {
      client,
      account: new Account(client),
      databases: new Databases(client),
      messaging: new Messaging(client),
      storage: new Storage(client),
      users: new Users(client),
    };
  }

/** Server-side TablesDB (admin API key). Use for CHAT / shared tables from server actions. */
export function createAdminTablesDB() {
  const apiKey = process.env.APPWRITE_API;

  if (!apiKey) {
    console.error('[Admin TablesDB] APPWRITE_API environment variable is missing.');
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey || '');

  return new TablesDB(client);
}
