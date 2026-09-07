'use client';

import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useRouter, useSearchParams } from 'next/navigation';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {

export function handleSecretSelect(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

        if (!user) return;
        setSending(true);
        try {
            if (type === 'totp') {
                const metadata: AttachmentMetadata = {
                    type: 'attachment',
                    entity: 'vault',
                    subType: 'totp',
                    referenceId: item.$id,
                    payload: {
                        label: item.issuer || item.name || 'TOTP',
                        currentCode: item.currentCode,
                        nextCode: item.nextCode, // Assuming this is passed or can be generated
                        expiry: new Date(Date.now() + 30000).toISOString()
                    }
                };
                await ChatService.sendMessage(
                    conversationId,
                    user.$id,
                    `TOTP: ${item.issuer || 'Unknown'}`,
                    'attachment',
                    [item.$id],
                    undefined,
                    metadata
                );
            } else {
                const metadata: AttachmentMetadata = {
                    type: 'attachment',
                    entity: 'vault',
                    subType: 'password',
                    referenceId: item.$id,
                    payload: {
                        label: item.name || 'Shared Password',
                        preview: '••••••••'
                    }
                };
                await ChatService.sendMessage(
                    conversationId,
                    user.$id,
                    `Secret: ${item.name || 'Unnamed'}`,
                    'attachment',
                    [item.$id],
                    undefined,
                    metadata
                );
            }
        } catch (error: unknown) {
            console.error('Failed to send secret/totp:', error);
            toast.error("Failed to attach secret");
        } finally {
            setSending(false);
        }
}
