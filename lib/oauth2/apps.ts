import { ID, Query } from 'appwrite';
import { appwriteSessionFetch } from './http';

export type OauthApp = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  description: string;
  clientUri: string;
  logoUri: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  contacts: string[];
  tagline: string;
  tags: string[];
  labels: string[];
  images: string[];
  supportUrl: string;
  dataDeletionUrl: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  enabled: boolean;
  type: string;
  deviceFlow?: boolean;
  userId?: string;
  teamId?: string;
};

export type OauthAppSecretPlaintext = {
  $id: string;
  appId: string;
  secret: string;
  hint: string;
  createdById: string;
  createdByName: string;
};

type AppsList = {
  total: number;
  apps: OauthApp[];
};

export async function listMyApps(userId: string): Promise<OauthApp[]> {
  const data = await appwriteSessionFetch<AppsList>('GET', '/apps', {
    query: {
      queries: [Query.equal('userId', userId), Query.limit(100)],
    },
  });
  return data?.apps || [];
}

export async function listApps(): Promise<OauthApp[]> {
  const data = await appwriteSessionFetch<AppsList>('GET', '/apps', {
    query: {
      queries: [Query.limit(100)],
    },
  });
  return data?.apps || [];
}

export async function getApp(appId: string): Promise<OauthApp> {
  return appwriteSessionFetch<OauthApp>('GET', `/apps/${encodeURIComponent(appId)}`);
}

export async function createApp(params: {
  name: string;
  redirectUris: string[];
  type?: 'confidential' | 'public';
  description?: string;
  logoUri?: string;
  tagline?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  postLogoutRedirectUris?: string[];
  deviceFlow?: boolean;
}): Promise<OauthApp> {
  return appwriteSessionFetch<OauthApp>('POST', '/apps', {
    body: {
      appId: ID.unique(),
      name: params.name,
      redirectUris: params.redirectUris,
      type: params.type || 'confidential',
      description: params.description,
      logoUri: params.logoUri,
      tagline: params.tagline,
      privacyPolicyUrl: params.privacyPolicyUrl,
      termsUrl: params.termsUrl,
      postLogoutRedirectUris: params.postLogoutRedirectUris,
      deviceFlow: params.deviceFlow ?? false,
      enabled: true,
    },
  });
}

export async function updateApp(
  appId: string,
  params: {
    name: string;
    redirectUris?: string[];
    type?: string;
    description?: string;
    logoUri?: string;
    tagline?: string;
    privacyPolicyUrl?: string;
    termsUrl?: string;
    postLogoutRedirectUris?: string[];
    deviceFlow?: boolean;
    enabled?: boolean;
  }
): Promise<OauthApp> {
  return appwriteSessionFetch<OauthApp>('PUT', `/apps/${encodeURIComponent(appId)}`, {
    body: {
      name: params.name,
      redirectUris: params.redirectUris,
      type: params.type,
      description: params.description,
      logoUri: params.logoUri,
      tagline: params.tagline,
      privacyPolicyUrl: params.privacyPolicyUrl,
      termsUrl: params.termsUrl,
      postLogoutRedirectUris: params.postLogoutRedirectUris,
      deviceFlow: params.deviceFlow,
      enabled: params.enabled,
    },
  });
}

export async function deleteApp(appId: string): Promise<void> {
  await appwriteSessionFetch('DELETE', `/apps/${encodeURIComponent(appId)}`);
}

export async function createAppSecret(appId: string): Promise<OauthAppSecretPlaintext> {
  return appwriteSessionFetch<OauthAppSecretPlaintext>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/secrets`,
    { body: {} }
  );
}

export async function deleteAppTokens(appId: string): Promise<void> {
  await appwriteSessionFetch('DELETE', `/apps/${encodeURIComponent(appId)}/tokens`);
}
