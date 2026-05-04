'use client';

import { useAuth } from '@/components/ui/AuthContext';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const useAI = () => {
  const { user } = useAuth();

  const generate = async (prompt: string, options: { 
    history?: AIChatMessage[], 
    systemInstruction?: string 
  } = {}) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    
    // Fallback for user custom key from prefs if relevant
    const customKey = user?.prefs?.customGeminiKey;
    if (customKey) {
      headers["x-user-gemini-key"] = customKey;
    }

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        prompt, 
        history: options.history,
        systemInstruction: options.systemInstruction 
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "AI Generation failed");
    }
    
    const data = await response.json();
    return data.text as string;
  };

  return { generate };
};
