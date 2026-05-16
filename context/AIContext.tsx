"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { AnalysisMode } from '@/lib/ai/types';
import { PrivacyFilter } from '@/lib/ai/sanitizer';
import { generateAIContent } from '@/lib/actions/ai';
import dynamic from 'next/dynamic';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [createModalHandler, setCreateModalHandler] = useState<((prefill?: { name?: string; url?: string; username?: string }) => void) | null>(null);

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
      const response = await generateAIContent({
        mode,
        data: sanitizedPayload,
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
  }, []);

  const askAI = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await generateAIContent({
        mode: 'GENERAL_QUERY',
        prompt,
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
  }, []);

  const sendCommand = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await generateAIContent({
        mode: 'COMMAND_INTENT',
        prompt,
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
  }, []);

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
