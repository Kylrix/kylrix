'use client';

import { useAuth } from '@/context/auth/AuthContext';
import { generateAIContent } from '@/lib/actions/ai';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useAI = () => {
  const { user, getJWT } = useAuth();

  const generate = async (prompt: string, options: {
    history?: AIChatMessage[],
    systemInstruction?: string
  } = {}) => {
    // Fallback for user custom key from prefs if relevant
    const customKey = user?.prefs?.customGeminiKey;
    const jwt = getJWT ? await getJWT() : null;

    const result = await generateAIContent({
      mode: 'GENERIC_CHAT',
      prompt,
      history: options.history,
      systemInstruction: options.systemInstruction,
      byokKey: customKey,
      jwt: jwt || undefined
    });

    if (!result.success) {
      throw new Error(result.error || "AI Generation failed");
    }

    return result.data as string;
  };

  return { generate };
};

