import {
  isPublicResumePath,
  LAST_ROUTE_COOKIE} from '@/lib/ecosystem/resume-route';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const STATE_STORAGE_KEY = 'kylrix_ecosystem_state_tracker';
const MAX_HISTORY = 15;

interface RouteState {
  path: string;
  scrollY: number;
  timestamp: number;
}

function mirrorLastRouteCookie(path: string) {
  try {
    const hostname = window.location.hostname;
    const domain =
      hostname === 'localhost' || hostname.startsWith('127.')
        ? ''
        : `.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;
    const domainStr = domain ? `domain=${domain}; ` : '';
    document.cookie = `${LAST_ROUTE_COOKIE}=${encodeURIComponent(path)}; path=/; ${domainStr}max-age=2592000; SameSite=Lax`;
  } catch {
    // Best effort only.
  }
}

export function saveEcosystemState(path: string, scrollY: number) {
  if (typeof window === 'undefined') return;
  if (isPublicResumePath(path)) return;
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    let history: RouteState[] = raw ? JSON.parse(raw) : [];

    history = history.filter(s => s.path !== path);
    history.unshift({ path, scrollY, timestamp: Date.now() });

    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(history));
    mirrorLastRouteCookie(path);
  } catch {
    // Ignore quota errors
  }
}

