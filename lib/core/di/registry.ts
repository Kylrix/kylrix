import { DatabasePort } from '../ports/database.port';
import { AuthPort } from '../ports/auth.port';
import { StoragePort } from '../ports/storage.port';
import { FunctionsPort } from '../ports/functions.port';
import { MessagingPort } from '../ports/messaging.port';

import { AppwriteDatabaseAdapter } from '../adapters/appwrite/database.adapter';
import { AppwriteAuthAdapter } from '../adapters/appwrite/auth.adapter';
import { AppwriteStorageAdapter } from '../adapters/appwrite/storage.adapter';
import { AppwriteFunctionsAdapter } from '../adapters/appwrite/functions.adapter';
import { AppwriteMessagingAdapter } from '../adapters/appwrite/messaging.adapter';

export class Registry {
  private static db: DatabasePort | null = null;
  private static auth: AuthPort | null = null;
  private static storage: StoragePort | null = null;
  private static functions: FunctionsPort | null = null;
  private static messaging: MessagingPort | null = null;

  static getDatabase(): DatabasePort {
    if (!this.db) {
      if (process.env.DATABASE_PROVIDER === 'sqlite' || process.env.NEXT_PUBLIC_DATABASE_PROVIDER === 'sqlite') {
        const { SqliteDatabaseAdapter } = require('../adapters/sqlite/database.adapter');
        this.db = new SqliteDatabaseAdapter();
      } else {
        this.db = new AppwriteDatabaseAdapter();
      }
    }
    return this.db!;
  }

  static getAuth(): AuthPort {
    if (!this.auth) {
      this.auth = new AppwriteAuthAdapter();
    }
    return this.auth;
  }

  static getStorage(): StoragePort {
    if (!this.storage) {
      this.storage = new AppwriteStorageAdapter();
    }
    return this.storage;
  }

  static getFunctions(): FunctionsPort {
    if (!this.functions) {
      this.functions = new AppwriteFunctionsAdapter();
    }
    return this.functions;
  }

  static getMessaging(): MessagingPort {
    if (!this.messaging) {
      this.messaging = new AppwriteMessagingAdapter();
    }
    return this.messaging;
  }

  /**
   * Enables seamless technology swapping or mock injection during testing or runtime.
   */
  static overrideDatabase(customDb: DatabasePort): void {
    this.db = customDb;
  }

  static overrideAuth(customAuth: AuthPort): void {
    this.auth = customAuth;
  }

  static overrideStorage(customStorage: StoragePort): void {
    this.storage = customStorage;
  }

  static overrideFunctions(customFunctions: FunctionsPort): void {
    this.functions = customFunctions;
  }

  static overrideMessaging(customMessaging: MessagingPort): void {
    this.messaging = customMessaging;
  }
}
