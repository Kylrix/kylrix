'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Notes } from '@/types/appwrite';

import { AgenticDiffViewer } from '@/components/agentic/AgenticDiffViewer';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';

import {

import { NoteDetailSidebarViewPart1 } from './NoteDetailSidebarViewPart1';
import { NoteDetailSidebarViewPart2 } from './NoteDetailSidebarViewPart2';

export function NoteDetailSidebarView(bag: any) {
  return (
    <>
      <NoteDetailSidebarViewPart1 {...bag} />
      <NoteDetailSidebarViewPart2 {...bag} />
    </>
  );
}
