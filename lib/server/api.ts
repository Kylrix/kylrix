'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveCurrentUser } from '@/lib/appwrite/client';
import { userHasPaidAiAccess } from '@/lib/server/ai-subscription-gate';
import { headers } from 'next/headers';

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function createCloudflareSession() {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    return { success: false, error: 'Cloudflare configuration missing' };
  }

  try {
    const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

export async function createCloudflareTracks(data: { sessionId: string; tracks: any[] }) {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    return { success: false, error: 'Cloudflare configuration missing' };
  }

  try {
    const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${data.sessionId}/tracks/new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks: data.tracks }),
    });

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const resData = await response.json();
    return { success: true, ...resData };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

export async function fetchTurnCredentials() {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;
  const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID || !TURN_KEY_ID) {
    return { success: false, error: 'Cloudflare configuration missing', iceServers: [] };
  }

  try {
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    if (!response.ok) {
      return { success: false, error: await response.text(), iceServers: [] };
    }

    const resData = await response.json();
    return { success: true, ...resData };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error', iceServers: [] };
  }
}

export async function subscribeToCloudflareTracks(data: { sessionId: string; tracks: any[] }) {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    return { success: false, error: 'Cloudflare configuration missing' };
  }

  try {
    const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${data.sessionId}/tracks/new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks: data.tracks }),
    });

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const resData = await response.json();
    return { success: true, ...resData };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

