import { DatabasePort } from '../ports/database.port';
import { AuthPort } from '../ports/auth.port';
import { FunctionsPort } from '../ports/functions.port';
import { MessagingPort, EmailPayload, UnorganicEmailPayload } from '../ports/messaging.port';

import { TursoDatabaseAdapter } from '../adapters/turso/database.adapter';
import { TursoAuthAdapter } from '../adapters/turso/auth.adapter';

export class StubFunctionsAdapter implements FunctionsPort {
  async executeFunction(_functionId: string, _data?: string): Promise<any> {
    return { status: 'completed', responseBody: '' };
  }
}

export class StubMessagingAdapter implements MessagingPort {
  async sendEmail(_payload: EmailPayload): Promise<{ success: boolean }> {
    return { success: true };
  }
  async dispatchUnorganicEmail(_payload: UnorganicEmailPayload): Promise<{ success: boolean }> {
    return { success: true };
  }
}

export class Registry {
  private static db: DatabasePort | null = null;
  private static auth: AuthPort | null = null;
  private static functions: FunctionsPort | null = null;
  private static messaging: MessagingPort | null = null;

  static getDatabase(): DatabasePort {
    if (!this.db) {
      this.db = new TursoDatabaseAdapter();
    }
    return this.db!;
  }

  static getAuth(): AuthPort {
    if (!this.auth) {
      this.auth = new TursoAuthAdapter();
    }
    return this.auth;
  }

  static getFunctions(): FunctionsPort {
    if (!this.functions) {
      this.functions = new StubFunctionsAdapter();
    }
    return this.functions;
  }

  static getMessaging(): MessagingPort {
    if (!this.messaging) {
      this.messaging = new StubMessagingAdapter();
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

  static overrideFunctions(customFunctions: FunctionsPort): void {
    this.functions = customFunctions;
  }

  static overrideMessaging(customMessaging: MessagingPort): void {
    this.messaging = customMessaging;
  }
}
