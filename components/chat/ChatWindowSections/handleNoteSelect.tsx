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

export function handleNoteSelect(bag: any) {
  const {
  handleExport,
  handleNoteSelect,
  seedConversationFromList
  } = bag as any;

        if (!user) return;
        setSending(true);
        try {
            const metadata = buildNoteAttachmentMetadata(note) as AttachmentMetadata;
            await ChatService.sendMessage(
                conversationId,
                user.$id,
                note.title || 'Attached Note',
                'attachment',
                [note.$id],
                undefined,
                metadata
            );
        } catch (error: unknown) {
            console.error('Failed to send note:', error);
            toast.error("Failed to attach note");
        } finally {
            setSending(false);
        }
}
