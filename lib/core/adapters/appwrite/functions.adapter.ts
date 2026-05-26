import { FunctionsPort } from '../../ports/functions.port';
import { createSystemClient } from '@/lib/appwrite-admin';

export class AppwriteFunctionsAdapter implements FunctionsPort {
  async executeFunction(
    functionId: string,
    data?: string,
    async?: boolean,
    path?: string,
    method?: string,
    headers?: Record<string, string>
  ): Promise<any> {
    const { Functions } = await import('node-appwrite');
    const { client } = createSystemClient();
    const functions = new Functions(client);

    const res = await functions.createExecution(
      functionId,
      data,
      async,
      path,
      method as any,
      headers
    );

    return JSON.parse(JSON.stringify(res));
  }
}
