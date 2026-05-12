"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
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
  
  // Global Action Handlers
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

  // Allow components to register themselves as the "Create Modal" handler
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

  const analyze = async (mode: AnalysisMode, rawData: unknown) => {
    setIsLoading(true);
    try {
      // 1. Sanitize Data on Client Side (Zero Knowledge Enforcement)
      const sanitizedPayload = PrivacyFilter.sanitize(mode, rawData);

      // 2. Call Server Action (Stateless Proxy)
      const response = await generateAIContent({
        mode,
        data: sanitizedPayload,
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // 3. Parse JSON response if expected
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
  };

  const askAI = async (prompt: string) => {
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
  };

  const sendCommand = async (prompt: string) => {
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
  };

  const openAIModal = useCallback(() => setIsAIModalOpen(true), []);
  const closeAIModal = useCallback(() => setIsAIModalOpen(false), []);

  /**
   * Memoize so consumers (toolbars, FABs, command palettes) don't re-render
   * each time AIProvider re-renders for unrelated reasons.
   * `analyze` / `askAI` / `sendCommand` are stable closures over setIsLoading;
   * they're referenced by identity, so this is safe to memoize.
   */
  const contextValue = useMemo<AIContextType>(
    () => ({
      analyze,
      askAI,
      sendCommand,
      openAIModal,
      closeAIModal,
      openGlobalCreateModal,
      registerCreateModal,
      isAIModalOpen,
      isLoading,
    }),
    [openAIModal, closeAIModal, openGlobalCreateModal, registerCreateModal, isAIModalOpen, isLoading]
  );

  return (
    <AIContext.Provider value={contextValue}>
      {children}
      {isAIModalOpen && <AIModal onClose={closeAIModal} />}
    </AIContext.Provider>
  );
}

