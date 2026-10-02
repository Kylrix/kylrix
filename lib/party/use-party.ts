'use client';

import usePartySocket from 'partysocket/react';

export const DEFAULT_PARTY_HOST =
  process.env.NEXT_PUBLIC_PARTY_HOST || 'localhost:1999';

export interface UsePartyOptions {
  room: string;
  party?: string;
  host?: string;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

/**
 * React hook to connect to a PartyKit room backed by Cloudflare Durable Objects.
 */
export function usePartyRoom({
  room,
  party,
  host = DEFAULT_PARTY_HOST,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UsePartyOptions) {
  return usePartySocket({
    host,
    room,
    party,
    onMessage,
    onOpen,
    onClose,
    onError,
  });
}
