'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useParams } from 'next/navigation';

export default function ChatPage() {
    const params = useParams();
    const conversationId = params.id as string;

    return (
        <AppShell>
            <ChatWindow conversationId={conversationId} />
        </AppShell>
    );
}
