"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { AnalysisMode } from '@/lib/ai/types';
import { PrivacyFilter } from '@/lib/ai/sanitizer';
import { generateAIContent } from '@/lib/actions/ai';
import { useLocalContext } from '@/lib/context-engine';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import { BYOKManager } from '@/lib/ai/byok';

const AIModal = dynamic(() => import("@/components/ai/AIModal").then(mod => mod.AIModal), {
  ssr: false
});

interface AIContextType {
  analyze: (mode: AnalysisMode, data: unknown) => Promise<unknown>;
  askAI: (prompt: string) => Promise<string>;
  sendCommand: (prompt: string) => Promise<{ action: string; data?: unknown; response?: string }>;
  openAIModal: () => void;
  closeAIModal: () => void;
  
  openGlobalCreateModal: (prefill?: { name?: string; url?: string; username?: string }) => void;
  registerCreateModal: (handler: (prefill?: { name?: string; url?: string; username?: string }) => void) => void;
  
  isAIModalOpen: boolean;
  isLoading: boolean;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}

export function AIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [createModalHandler, setCreateModalHandler] = useState<((prefill?: { name?: string; url?: string; username?: string }) => void) | null>(null);
  const { compileContextForAI } = useLocalContext();

  const registerCreateModal = useCallback((handler: (prefill?: { name?: string; url?: string; username?: string }) => void) => {
    setCreateModalHandler(() => handler);
  }, []);

  const openGlobalCreateModal = useCallback((prefill?: { name?: string; url?: string; username?: string }) => {
    if (createModalHandler) {
        createModalHandler(prefill);
    } else {
        console.warn("No Create Modal Handler registered");
    }
  }, [createModalHandler]);

  const analyze = useCallback(async (mode: AnalysisMode, rawData: unknown) => {
    setIsLoading(true);
    try {
      const sanitizedPayload = PrivacyFilter.sanitize(mode, rawData);
      
      let byokKey: string | undefined = undefined;
      if (user?.$id && BYOKManager.isUnlocked()) {
        const key = await BYOKManager.retrieveKey(user.$id, 'gemini');
        if (key) byokKey = key;
      }

      const response = await generateAIContent({
        mode,
        data: sanitizedPayload,
        byokKey,
        localContext: compileContextForAI(),
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      try {
        return JSON.parse(response.data || "{}");
      } catch {
        return response.data;
      }
    } catch (error: unknown) {
      console.error("AI Analysis Failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user?.$id, compileContextForAI]);

  const askAI = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      let byokKey: string | undefined = undefined;
      if (user?.$id && BYOKManager.isUnlocked()) {
        const key = await BYOKManager.retrieveKey(user.$id, 'gemini');
        if (key) byokKey = key;
      }

      const response = await generateAIContent({
        mode: 'GENERAL_QUERY',
        prompt,
        byokKey,
        localContext: compileContextForAI(),
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data || "";
    } catch (error: unknown) {
      console.error("AI Query Failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user?.$id, compileContextForAI]);

  const sendCommand = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      let byokKey: string | undefined = undefined;
      if (user?.$id && BYOKManager.isUnlocked()) {
        const key = await BYOKManager.retrieveKey(user.$id, 'gemini');
        if (key) byokKey = key;
      }

      const response = await generateAIContent({
        mode: 'COMMAND_INTENT',
        prompt,
        byokKey,
        localContext: compileContextForAI(),
      });

      if (!response.success) throw new Error(response.error);
      
      try {
        return JSON.parse(response.data || "{}");
      } catch {
        return { action: "UNKNOWN", response: response.data };
      }
    } catch (error: unknown) {
        console.error("AI Command Failed", error);
        throw error;
    } finally {
        setIsLoading(false);
    }
  }, [user?.$id, compileContextForAI]);

  const openAIModal = useCallback(() => setIsAIModalOpen(true), []);
  const closeAIModal = useCallback(() => setIsAIModalOpen(false), []);

  const contextValue = useMemo(() => ({
    analyze,
    askAI,
    sendCommand,
    openAIModal,
    closeAIModal,
    openGlobalCreateModal,
    registerCreateModal,
    isAIModalOpen,
    isLoading,
  }), [analyze, askAI, sendCommand, openAIModal, closeAIModal, openGlobalCreateModal, registerCreateModal, isAIModalOpen, isLoading]);

  return (
    <AIContext.Provider value={contextValue}>
      {children}
      {isAIModalOpen && <AIModal onClose={closeAIModal} />}
    </AIContext.Provider>
  );
}
