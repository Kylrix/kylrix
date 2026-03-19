import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';
import { APPWRITE_CONFIG } from './appwrite/config';

export const APPWRITE_ENDPOINT = 'https://api.kylrix.space/v1';
export const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

const client = new Client()
  .setEndpoint('https://api.kylrix.space/v1')
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
export const APPWRITE_TABLE_ID_USERS = APPWRITE_CONFIG.TABLES.NOTE.USERS;
export const APPWRITE_DATABASE_ID_CONNECT = APPWRITE_CONFIG.DATABASES.CONNECT;
export const APPWRITE_TABLE_ID_CONNECT_USERS = APPWRITE_CONFIG.TABLES.CONNECT.USERS;
export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

export { client, account, databases, storage, ID, Query };

export async function getProfilePicturePreview(fileId: string, width = 100, height = 100) {
  try {
    return storage.getFilePreview(APPWRITE_BUCKET_PROFILE_PICTURES, fileId, width, height).toString();
  } catch (error) {
    console.error('getProfilePicturePreview error:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function getUser(userId: string) {
  return databases.getDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId
  );
}

export async function createUser(data: any) {
  return databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    data.id || ID.unique(),
    {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
}

export async function updateUser(userId: string, data: any) {
  return databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId,
    {
      ...data,
      updatedAt: new Date().toISOString()
    }
  );
}

export async function getGlobalProfile(username: string) {
  try {
    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID_CONNECT,
      APPWRITE_TABLE_ID_CONNECT_USERS,
      [Query.equal('username', username.toLowerCase())]
    );
    return res.documents[0] || null;
  } catch (error) {
    console.error('getGlobalProfile error:', error);
    return null;
  }
}
