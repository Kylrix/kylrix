'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveCurrentUser } from '@/lib/appwrite/client';
import { headers } from 'next/headers';

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function createCloudflareSession() {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function createCloudflareTracks(data: { sessionId: string; tracks: any[] }) {
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${data.sessionId}/tracks/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tracks: data.tracks }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function generateAIResponse(data: {
  prompt: string;
  history?: AIChatMessage[];
  systemInstruction?: string;
  apiKey?: string;
}) {
    // In Next.js 15, we can use headers() to get request info if needed by resolveCurrentUser
    const userHeaders = await headers();
    const user = await resolveCurrentUser(userHeaders as any);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const apiKey = data.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('AI service not configured');
    }

    if (!data.apiKey) {
      const plan = (user).prefs?.subscriptionTier || 'FREE';
      const isPro = ['PRO', 'ORG', 'LIFETIME'].includes(plan);
      if (!isPro) {
        throw new Error('AI features require a Pro account. Upgrade to continue or provide your own API key in settings.');
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
      systemInstruction: data.systemInstruction || "You are Kylrixbot, an intelligent assistant for Kylrixconnect, a premium secure communication and networking app. You represent 'Quiet Power' and 'The Glass Monolith' aesthetic. Be concise, professional, and helpful. Help users communicate more effectively while maintaining privacy.",
    });

    if (data.history && data.history.length > 0) {
      const chat = model.startChat({
        history: data.history.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
      });
      const result = await chat.sendMessage(data.prompt);
      return result.response.text();
    }

    const result = await model.generateContent(data.prompt);
    return result.response.text();
}
