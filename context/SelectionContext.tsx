'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export type SelectableKind = 'note' | 'goal' | 'task' | 'event' | 'credential' | 'totp' | 'form' | string;

export interface SelectionState {
  isSelectMode: boolean;
  kind: SelectableKind | null;
  selectedIds: string[];
}

interface SelectionContextType {
  isSelectMode: boolean;
  activeKind: SelectableKind | null;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string, kind?: SelectableKind) => boolean;
  enterSelectMode: (kind: SelectableKind, initialId?: string) => void;
  exitSelectMode: () => void;
  toggleSelect: (id: string, kind?: SelectableKind) => void;
  selectAll: (ids: string[], kind?: SelectableKind) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SelectionState>({
    isSelectMode: false,
    kind: null,
    selectedIds: [],
  });

  const enterSelectMode = useCallback((kind: SelectableKind, initialId?: string) => {
    setState({
      isSelectMode: true,
      kind,
      selectedIds: initialId ? [initialId] : [],
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setState({
      isSelectMode: false,
      kind: null,
      selectedIds: [],
    });
  }, []);

  const toggleSelect = useCallback((id: string, kind?: SelectableKind) => {
    setState((prev) => {
      if (!prev.isSelectMode) {
        return {
          isSelectMode: true,
          kind: kind || prev.kind || null,
          selectedIds: [id],
        };
      }
      const nextIds = prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((item) => item !== id)
        : [...prev.selectedIds, id];
      return {
        ...prev,
        selectedIds: nextIds,
      };
    });
  }, []);

  const selectAll = useCallback((ids: string[], kind?: SelectableKind) => {
    setState((prev) => ({
      isSelectMode: true,
      kind: kind || prev.kind,
      selectedIds: Array.from(new Set([...prev.selectedIds, ...ids])),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIds: [],
    }));
  }, []);

  const isSelected = useCallback(
    (id: string, kind?: SelectableKind) => {
      if (!state.isSelectMode) return false;
      if (kind && state.kind && kind !== state.kind) return false;
      return state.selectedIds.includes(id);
    },
    [state.isSelectMode, state.kind, state.selectedIds],
  );

  const value = useMemo<SelectionContextType>(
    () => ({
      isSelectMode: state.isSelectMode,
      activeKind: state.kind,
      selectedIds: state.selectedIds,
      selectedCount: state.selectedIds.length,
      isSelected,
      enterSelectMode,
      exitSelectMode,
      toggleSelect,
      selectAll,
      clearSelection,
    }),
    [
      state.isSelectMode,
      state.kind,
      state.selectedIds,
      isSelected,
      enterSelectMode,
      exitSelectMode,
      toggleSelect,
      selectAll,
      clearSelection,
    ],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}
