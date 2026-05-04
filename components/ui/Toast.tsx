'use client';

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { useIsland, IslandType } from './DynamicIsland';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number, defaultExpanded?: boolean) => void;
  dismissToast: (id: string) => void;
  showError: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showSuccess: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showWarning: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showInfo: (title: string, message?: string, defaultExpanded?: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { showIsland } = useIsland();

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 5000, defaultExpanded = false) => {
    showIsland({
      type: type as IslandType,
      title,
      message,
      duration,
      defaultExpanded,
    });
  }, [showIsland]);

  const dismissToast = useCallback((_id: string) => {
    void _id;
  }, []);

  const showError = useCallback((title: string, message?: string, defaultExpanded = false) => {
    showToast('error', title, message, 5000, defaultExpanded);
  }, [showToast]);

  const showSuccess = useCallback((title: string, message?: string, defaultExpanded = false) => {
    showToast('success', title, message, 5000, defaultExpanded);
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, defaultExpanded = false) => {
    showToast('warning', title, message, 5000, defaultExpanded);
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, defaultExpanded = false) => {
    showToast('info', title, message, 5000, defaultExpanded);
  }, [showToast]);

  const value: ToastContextType = {
    showToast,
    dismissToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Old Toast System replaced by Dynamic Island */}
      {/* <Stack spacing={2} sx={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, width: '100%', maxWidth: 400 }}>
        ...
      </Stack> */}
    </ToastContext.Provider>
  );
}
