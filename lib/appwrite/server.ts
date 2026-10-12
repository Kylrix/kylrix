import { APPWRITE_CONFIG } from './config';
import { cache } from 'react';

class ServerClientStub {
  endpoint = '';
  project = '';
  jwt = '';
  session = '';
  setEndpoint(e: string) { this.endpoint = e; return this; }
  setProject(p: string) { this.project = p; return this; }
  setJWT(j: string) { this.jwt = j; return this; }
  setSession(s: string) { this.session = s; return this; }
  addHeader(_k: string, _v: string) { return this; }
}

class ServerAccountStub {
  constructor(_client?: any) {}
  async get(): Promise<any> { return null; }
  async createJWT() { return { jwt: '' }; }
  async listSessions() { return { sessions: [] }; }
  async deleteSession(_id: string) { return {}; }
  async deleteSessions() { return {}; }
  async getPrefs(): Promise<Record<string, any>> { return {}; }
  async updatePrefs(prefs: Record<string, any>): Promise<Record<string, any>> { return prefs; }
}

export const createServerClient = cache(async (_jwt?: string) => {
  const client = new ServerClientStub();
  client.setEndpoint(APPWRITE_CONFIG.SERVER_ENDPOINT);
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);

  return {
    client,
    account: new ServerAccountStub(client)};
});
