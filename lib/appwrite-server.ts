import { Client, Account } from 'node-appwrite';
import { cookies } from 'next/headers';
import { APPWRITE_CONFIG } from './appwrite/config';

export async function createServerClient(req?: Request) {
  const client = new Client();

  client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);

  const authHeader = req?.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    client.setJWT(authHeader.split(' ')[1]);
  } else {
    const cookieStore = await cookies();
    const sessionName = `a_session_${APPWRITE_CONFIG.PROJECT_ID.toLowerCase()}`;
    const sessionCookie = cookieStore.get(sessionName) || cookieStore.get(`${sessionName}_legacy`);

    if (sessionCookie?.value) {
      client.setSession(sessionCookie.value);
    }
  }

  return {
    client,
    account: new Account(client),
  };
}
