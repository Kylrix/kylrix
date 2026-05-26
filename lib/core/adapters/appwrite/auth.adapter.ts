import { AuthPort, Actor } from '../../ports/auth.port';
import { createServerClient } from '@/lib/appwrite-server-only';
import { isEmailInAdminList } from '@/lib/appwrite-admin';

export class AppwriteAuthAdapter implements AuthPort {
  async getActor(jwt?: string): Promise<Actor | null> {
    try {
      const { account } = await createServerClient(jwt);
      const user = await account.get().catch(() => null);
      if (!user) {
        return null;
      }
      
      const isAdmin = isEmailInAdminList(user.email);
      
      return {
        $id: user.$id,
        email: user.email || '',
        name: user.name || '',
        emailVerification: !!user.emailVerification,
        isAdmin,
      };
    } catch (err) {
      console.error('[AppwriteAuthAdapter] Failed to get actor:', err);
      return null;
    }
  }

  async createJWT(): Promise<{ jwt: string }> {
    const { client } = await createServerClient();
    const { Account } = await import('node-appwrite');
    const account = new Account(client);
    const res = await account.createJWT();
    return { jwt: res.jwt };
  }

  isEmailAdmin(email: string): boolean {
    return isEmailInAdminList(email);
  }
}
