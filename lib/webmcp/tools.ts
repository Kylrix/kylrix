/**
 * Official WebMCP Tool Suite for Kylrix
 * Exposes full 1:1 productivity, collaboration, and workspace capabilities to in-browser AI agents.
 * Resilient to zero-backend / offline mode by querying LocalEngine, RxDB, and localStorage substrates.
 */

import type { WebMcpToolDefinition } from './types';
import {
  createNote,
  updateNote,
  deleteNote,
  createProject,
  createEvent,
  postThreadMessage,
  getOrCreateThread,
  createRow,
} from '@/lib/actions/client-ops';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { BUILTIN_FLOWS } from '@/lib/flows/builtins';
import { listInstalledFlowIds } from '@/lib/flows/installed';
import { Query } from 'appwrite';

/** Helper to format standard JSON content results for WebMCP agents */
function formatResult(data: any, summary?: string) {
  return {
    content: [
      {
        type: 'json' as const,
        data,
      },
      ...(summary
        ? [
            {
              type: 'text' as const,
              text: summary,
            },
          ]
        : []),
    ],
    meta: { count: Array.isArray(data) ? data.length : 1 },
  };
}

/** Helper to get current user ID or fallback offline user ID */
function getEffectiveUserId(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    const authRaw = window.localStorage.getItem('kylrix_auth_user');
    if (authRaw) {
      const parsed = JSON.parse(authRaw);
      if (parsed?.$id || parsed?.id) return parsed.$id || parsed.id;
    }
  } catch {}
  return 'offline_user';
}

/** Helper to read JSON from localStorage safely */
function readLocalStorageJson<T = any>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

import { KYLRIX_WEBMCP_TOOLS_PART1 } from './tools-part1';
import { KYLRIX_WEBMCP_TOOLS_PART2 } from './tools-part2';
export const KYLRIX_WEBMCP_TOOLS = [
  ...KYLRIX_WEBMCP_TOOLS_PART1,
  ...KYLRIX_WEBMCP_TOOLS_PART2,
];
