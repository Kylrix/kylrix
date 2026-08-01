import { OAUTH2_PROJECT_ID } from './config';
import { appwriteSessionFetch } from './http';

export type Oauth2Grant = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId: string;
  appId: string;
  scopes: string[];
  resources: string[];
  authorizationDetails: string;
  prompt: string;
  redirectUri: string;
  authTime: number;
  expire: string;
};

export type Oauth2Authorize = {
  grantId: string;
  redirectUrl: string;
};

export type Oauth2RedirectResult = {
  redirectUrl: string;
};

const base = (suffix: string) => `/oauth2/${OAUTH2_PROJECT_ID}${suffix}`;

export async function getGrant(grantId: string): Promise<Oauth2Grant> {
  return appwriteSessionFetch<Oauth2Grant>('GET', base(`/grants/${encodeURIComponent(grantId)}`));
}

export async function approveGrant(params: {
  grantId: string;
  scope?: string;
  authorizationDetails?: string;
}): Promise<Oauth2RedirectResult> {
  const body: Record<string, unknown> = { grant_id: params.grantId };
  if (params.scope != null) body.scope = params.scope;
  if (params.authorizationDetails != null) {
    body.authorization_details = params.authorizationDetails;
  }
  return appwriteSessionFetch<Oauth2RedirectResult>('POST', base('/approve'), { body });
}

export async function rejectGrant(grantId: string): Promise<Oauth2RedirectResult> {
  return appwriteSessionFetch<Oauth2RedirectResult>('POST', base('/reject'), {
    body: { grant_id: grantId },
  });
}

/** After sign-in when consent URL has authorize params but no grant_id. */
export async function authorize(params: {
  clientId?: string;
  redirectUri?: string;
  responseType?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  prompt?: string;
  maxAge?: string;
  authorizationDetails?: string;
  resource?: string;
  audience?: string;
  requestUri?: string;
}): Promise<Oauth2Authorize> {
  return appwriteSessionFetch<Oauth2Authorize>('GET', base('/authorize'), {
    query: {
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      response_type: params.responseType,
      scope: params.scope,
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: params.codeChallengeMethod,
      prompt: params.prompt,
      max_age: params.maxAge,
      authorization_details: params.authorizationDetails,
      resource: params.resource,
      audience: params.audience,
      request_uri: params.requestUri,
    },
  });
}

export async function createDeviceGrant(userCode: string): Promise<Oauth2Grant> {
  return appwriteSessionFetch<Oauth2Grant>('POST', base('/grants'), {
    body: { user_code: userCode },
  });
}
