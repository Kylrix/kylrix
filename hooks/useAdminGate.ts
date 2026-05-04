'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, Account } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

interface AdminGateState {
  loading: boolean;
  authorized: boolean;
  error?: string | null;
  jwt?: string | null;
}

// Creates and caches a short lived JWT, validates admin via /api/admin/check
export function useAdminGate() {
  const [state, setState] = useState<AdminGateState>({ loading: true, authorized: false, error: null, jwt: null });
  const creatingRef = useRef(false);

  const obtain = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const endpoint = APPWRITE_CONFIG.ENDPOINT;
      const project = APPWRITE_CONFIG.PROJECT_ID;
      if (!endpoint || !project) throw new Error('Missing Appwrite config');
      const client = new Client().setEndpoint(endpoint).setProject(project);
      const account = new Account(client);
      const jwtRes = await account.createJWT();
      const token = jwtRes?.jwt;
      if (!token) throw new Error('No token');
      const check = await fetch('/api/admin/check', { headers: { Authorization: `Bearer ${token}` } });
      if (!check.ok) {
        const j = await check.json().catch(()=>({}));
        throw new Error(j.error || 'Forbidden');
      }
      setState({ loading: false, authorized: true, error: null, jwt: token });
    } catch (e: any) {
      setState({ loading: false, authorized: false, error: e.message || 'Access denied', jwt: null });
    } finally {
      creatingRef.current = false;
    }
  }, []);

  useEffect(() => { obtain(); }, [obtain]);

  const refresh = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    obtain();
  }, [obtain]);

  return { ...state, refresh };
}
