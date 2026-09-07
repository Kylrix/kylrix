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

export function seedConversationFromList(bag: any) {
  const {
  handleExport,
  handleNoteSelect,
  seedConversationFromList
  } = bag as any;

    const fromList = peekChatsListMemory().find(
        (c: any) => c.$id === conversationId || c.id === conversationId,
    );
    if (fromList) {
        const name = resolveConversationHeaderName({
            conversation: fromList,
            currentUserId,
            seedTitle,
        });
        if (!name) return fromList;
        return name === fromList.name ? fromList : { ...fromList, name, title: name };
    }
    if (seedTitle) {
        return {
            $id: conversationId,
            id: conversationId,
            name: seedTitle,
            title: seedTitle,
            type: 'direct',
            participants: [],
        };
    }
    return null;
}
